import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SelectSearch } from '@/components/ui/select-search';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { GuestPicker } from '@/features/guests/components/GuestPicker';
import type { GuestSelection } from '@/features/guests/components/GuestPicker';
import { estimatePrice } from '../../reservations/api';
import { toISODate } from '../../reservations/date-utils';
import type { FormuleHebergement, Room } from '../../reservations/types';
import type { WalkinCheckinInput } from '../types';

// CH-061 (Lot #3 design) — même liste que CreateReservationDialog.
const FORMULE_OPTIONS: { value: FormuleHebergement; label: string }[] = [
  { value: 'ROOM_ONLY', label: 'Logement seul' },
  { value: 'BED_AND_BREAKFAST', label: 'Petit-déjeuner' },
  { value: 'HALF_BOARD', label: 'Demi-pension' },
  { value: 'FULL_BOARD', label: 'Pension complète' },
];

interface Props {
  open: boolean;
  rooms: Room[];
  onClose: () => void;
  onConfirm: (input: WalkinCheckinInput) => void;
  submitting: boolean;
  error: string | null;
}

export function WalkinCheckinDialog({
  open,
  rooms,
  onClose,
  onConfirm,
  submitting,
  error,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        {/* Le formulaire n'est monté que pendant l'ouverture : il repart
            toujours d'un état vide sans avoir besoin d'un effect de reset. */}
        {open && (
          <WalkinForm
            rooms={rooms}
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

function WalkinForm({
  rooms,
  onClose,
  onConfirm,
  submitting,
  error,
}: Omit<Props, 'open'>) {
  const [roomId, setRoomId] = useState('');
  const [dateCheckoutPrevue, setDateCheckoutPrevue] = useState('');
  const [formule, setFormule] =
    useState<FormuleHebergement>('BED_AND_BREAKFAST');
  const [guestSelection, setGuestSelection] = useState<GuestSelection | null>(
    null,
  );
  const [prixEstime, setPrixEstime] = useState<string | null>(null);
  const [estimating, setEstimating] = useState(false);

  const selectedRoom = rooms.find((room) => String(room.id) === roomId);

  // CH-061 (Lot #3 design) — arrivée = aujourd'hui (walk-in), seule la date
  // de départ est saisie par la réception.
  useEffect(() => {
    let cancelled = false;
    async function fetchEstimate() {
      if (!selectedRoom || !dateCheckoutPrevue) {
        setPrixEstime(null);
        return;
      }
      setEstimating(true);
      try {
        const res = await estimatePrice({
          roomTypeId: selectedRoom.roomTypeId,
          dateArrivee: toISODate(new Date()),
          dateDepart: dateCheckoutPrevue,
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
  }, [selectedRoom, dateCheckoutPrevue, formule]);

  return (
    <>
      <DialogHeader>
        <DialogTitle>Check-in walk-in</DialogTitle>
      </DialogHeader>

      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (!roomId || !dateCheckoutPrevue || !guestSelection) return;
          onConfirm({
            roomId: Number(roomId),
            dateCheckoutPrevue,
            formule,
            ...guestSelection,
          });
        }}
      >
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="room">Chambre</Label>
          <SelectSearch
            id="room"
            value={roomId}
            onValueChange={setRoomId}
            placeholder="Chercher une chambre (numéro, type)…"
            emptyMessage="Aucune chambre ne correspond."
            items={rooms.map((room) => ({
              value: String(room.id),
              label: `${room.numero} — ${room.roomType.nom}`,
            }))}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="dateCheckoutPrevue">Départ prévu</Label>
          <Input
            id="dateCheckoutPrevue"
            type="date"
            value={dateCheckoutPrevue}
            onChange={(e) => setDateCheckoutPrevue(e.target.value)}
            required
          />
        </div>

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

        {selectedRoom && dateCheckoutPrevue && (
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
        )}

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
          <Button
            type="submit"
            disabled={
              submitting || !roomId || !dateCheckoutPrevue || !guestSelection
            }
          >
            {submitting ? 'Enregistrement…' : 'Enregistrer le check-in'}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}
