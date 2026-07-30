import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { GuestPicker } from '@/features/guests/components/GuestPicker';
import type { GuestSelection } from '@/features/guests/components/GuestPicker';
import { estimatePrice } from '../api';
import type { FormuleHebergement, Room } from '../types';

export interface CreateReservationSelection {
  room: Room;
  dateArrivee: string;
  dateDepart: string;
}

export type CreateReservationConfirmInput = GuestSelection & {
  formule: FormuleHebergement;
};

interface Props {
  selection: CreateReservationSelection | null;
  onClose: () => void;
  onConfirm: (input: CreateReservationConfirmInput) => void;
  submitting: boolean;
  error: string | null;
}

// CH-061 (Lot #3 design) — même convention de libellés que ParametersPage
// (grille tarifaire des types de chambre, HotelIdentitySection).
const FORMULE_OPTIONS: { value: FormuleHebergement; label: string }[] = [
  { value: 'ROOM_ONLY', label: 'Logement seul' },
  { value: 'BED_AND_BREAKFAST', label: 'Petit-déjeuner' },
  { value: 'HALF_BOARD', label: 'Demi-pension' },
  { value: 'FULL_BOARD', label: 'Pension complète' },
];

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
  const [formule, setFormule] =
    useState<FormuleHebergement>('BED_AND_BREAKFAST');
  const [prixEstime, setPrixEstime] = useState<string | null>(null);
  const [estimating, setEstimating] = useState(false);

  // CH-061 (Lot #3 design) — recalculé à chaque changement de formule,
  // jamais côté client (mêmes règles de tarification saisonnière que la
  // création réelle, ReservationsService.calculatePrixTotal côté serveur).
  useEffect(() => {
    let cancelled = false;
    async function fetchEstimate() {
      setEstimating(true);
      try {
        const res = await estimatePrice({
          roomTypeId: selection.room.roomTypeId,
          dateArrivee: selection.dateArrivee,
          dateDepart: selection.dateDepart,
          formule,
        });
        if (!cancelled) setPrixEstime(res.prixEstime);
      } catch {
        if (!cancelled) setPrixEstime(null);
      } finally {
        if (!cancelled) setEstimating(false);
      }
    }
    void fetchEstimate();
    return () => {
      cancelled = true;
    };
  }, [
    selection.room.roomTypeId,
    selection.dateArrivee,
    selection.dateDepart,
    formule,
  ]);

  return (
    <>
      <DialogHeader>
        <DialogTitle>Nouvelle réservation</DialogTitle>
      </DialogHeader>

      <p className="text-muted-foreground text-sm">
        Chambre {selection.room.numero} ({selection.room.roomType.nom}) — du{' '}
        {selection.dateArrivee} au {selection.dateDepart}
      </p>

      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (!guestSelection) return;
          onConfirm({ ...guestSelection, formule });
        }}
      >
        <GuestPicker onChange={setGuestSelection} />

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="formule">Formule</Label>
          <Select
            value={formule}
            onValueChange={(v) => v && setFormule(v as FormuleHebergement)}
          >
            <SelectTrigger id="formule">
              <SelectValue>
                {(value: FormuleHebergement | null) =>
                  FORMULE_OPTIONS.find((option) => option.value === value)
                    ?.label ?? ''
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {FORMULE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="bg-muted flex items-center justify-between rounded-md px-3 py-2 text-sm">
          <span className="text-muted-foreground">Prix total estimé</span>
          <span className="font-mono font-semibold">
            {estimating
              ? '…'
              : prixEstime !== null
                ? `${Number(prixEstime).toFixed(2)} MAD`
                : '—'}
          </span>
        </div>

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
            {submitting ? 'Création…' : 'Créer la réservation'}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}
