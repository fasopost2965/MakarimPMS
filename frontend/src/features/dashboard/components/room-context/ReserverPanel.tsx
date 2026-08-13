import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  CreateReservationDialog,
  type CreateReservationConfirmInput,
} from '../../../reservations/components/CreateReservationDialog';
import { createReservation } from '../../../reservations/api';
import { addDays, toISODate } from '../../../reservations/date-utils';
import type { Room } from '../../../reservations/types';

interface Props {
  room: Room;
  rooms: Room[];
  permissions: string[] | null;
  onReserved?: () => void;
}

// DESIGN-006 (mission §4) — réutilise CreateReservationDialog tel quel
// (déjà utilisé par ReservationsCalendarPage pour le drag-and-drop) : ni la
// disponibilité, ni le calcul tarifaire, ni la création ne sont dupliqués
// ici. `selection` pré-remplit uniquement la chambre et une plage de dates
// par défaut (aujourd'hui → demain), modifiable par l'utilisateur avant
// confirmation (Discovery Phase 1 §3).
export function ReserverPanel({ room, rooms, permissions, onReserved }: Props) {
  const canWrite = permissions?.includes('reservations:write') ?? false;
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  async function handleConfirm(input: CreateReservationConfirmInput) {
    const { prixTotalFinal, motifAjustement, ...createInput } = input;
    void prixTotalFinal;
    void motifAjustement;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await createReservation(createInput);
      setDialogOpen(false);
      onReserved?.();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Erreur de création');
    } finally {
      setSubmitting(false);
    }
  }

  const today = new Date();

  return (
    <div className="flex flex-col gap-3">
      <p className="text-muted-foreground text-sm">
        {room.roomType.nom} — capacité {room.roomType.capacite}
      </p>
      {canWrite ? (
        <>
          <Button
            type="button"
            className="self-start"
            onClick={() => setDialogOpen(true)}
          >
            Réserver cette chambre
          </Button>
          <CreateReservationDialog
            open={dialogOpen}
            selection={{
              room,
              dateArrivee: toISODate(today),
              dateDepart: toISODate(addDays(today, 1)),
            }}
            rooms={rooms}
            onClose={() => {
              setDialogOpen(false);
              setSubmitError(null);
            }}
            onConfirm={(input) => void handleConfirm(input)}
            submitting={submitting}
            error={submitError}
          />
        </>
      ) : (
        <p className="text-muted-foreground text-xs">
          Vous n'avez pas la permission de créer une réservation.
        </p>
      )}
    </div>
  );
}
