import { useEffect, useMemo, useState } from 'react';
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
import { addDays, toISODate } from '../date-utils';
import type {
  CanalReservation,
  FormuleHebergement,
  Room,
  RoomType,
  StatutChambre,
} from '../types';

export interface CreateReservationSelection {
  room: Room;
  dateArrivee: string;
  dateDepart: string;
}

// L'ajustement manuel du prix final n'existe pas comme option de création
// côté backend (CreateReservationDto n'a pas de prixTotalFinal) — seul
// PATCH /reservations/:id le permet (UpdateReservationDto, motif >= 10
// caractères). Le mockup ReservationForm.dc.html présente pourtant
// l'ajustement dans la même fiche que la création : pour honorer cette UX
// sans changement backend, le parent (ReservationsCalendarPage) enchaîne
// createReservation() puis updateReservation() quand prixTotalFinal est
// présent — voir CreateReservationConfirmInput ci-dessous.
export type CreateReservationConfirmInput = GuestSelection & {
  roomId: number;
  dateArrivee: string;
  dateDepart: string;
  canal: CanalReservation;
  formule: FormuleHebergement;
  prixTotalFinal?: number;
  motifAjustement?: string;
};

interface Props {
  open: boolean;
  selection: CreateReservationSelection | null;
  rooms: Room[];
  onClose: () => void;
  onConfirm: (input: CreateReservationConfirmInput) => void;
  submitting: boolean;
  error: string | null;
}

// Handoff design batch 3 (ReservationForm.dc.html, Lot #7) — seuls les 3
// canaux qu'un réceptionniste saisit lui-même à la main (walk-in, appel/
// email direct, relais téléphonique Booking.com). EXPEDIA/AIRBNB
// n'arrivent que par le webhook du channel-manager (F10), jamais saisis
// manuellement ici.
const CANAL_OPTIONS: { value: CanalReservation; label: string }[] = [
  { value: 'WALK_IN', label: 'Walk-in' },
  { value: 'DIRECT', label: 'Direct (téléphone/email)' },
  { value: 'BOOKING_COM', label: 'Booking.com' },
];

// CH-061 (Lot #3 design) — même convention de libellés que ParametersPage
// (grille tarifaire des types de chambre, HotelIdentitySection).
const FORMULE_OPTIONS: { value: FormuleHebergement; label: string }[] = [
  { value: 'ROOM_ONLY', label: 'Logement seul' },
  { value: 'BED_AND_BREAKFAST', label: '+ Petit-déj.' },
  { value: 'HALF_BOARD', label: 'Demi-pension' },
  { value: 'FULL_BOARD', label: 'Pension complète' },
];

// Même convention que RoomHistoryDialog.tsx/HousekeepingPage.tsx (chaque
// écran garde sa propre copie locale de ce libellé dans ce projet).
const STATUT_LABEL: Record<StatutChambre, string> = {
  LIBRE_PROPRE: 'libre',
  RESERVEE: 'réservée',
  OCCUPEE: 'occupée',
  DEPART_PREVU: 'départ prévu',
  A_NETTOYER: 'à nettoyer',
  EN_NETTOYAGE: 'en nettoyage',
  EN_MAINTENANCE: 'en maintenance',
};

export function CreateReservationDialog({
  open,
  selection,
  rooms,
  onClose,
  onConfirm,
  submitting,
  error,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-[640px]">
        {open && (
          // Clé = remonte le formulaire (champs vides) à chaque nouvelle
          // ouverture, sans passer par un effect pour resynchroniser l'état.
          <ReservationForm
            key={
              selection
                ? `${selection.room.id}-${selection.dateArrivee}-${selection.dateDepart}`
                : 'manual'
            }
            selection={selection}
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

function ReservationForm({
  selection,
  rooms,
  onClose,
  onConfirm,
  submitting,
  error,
}: Omit<Props, 'open'>) {
  const roomTypes = useMemo(() => {
    const map = new Map<number, RoomType>();
    for (const room of rooms) map.set(room.roomTypeId, room.roomType);
    return [...map.values()];
  }, [rooms]);

  const [canal, setCanal] = useState<CanalReservation>('WALK_IN');
  const [guestSelection, setGuestSelection] = useState<GuestSelection | null>(
    null,
  );
  const [roomTypeId, setRoomTypeId] = useState<number | null>(
    selection?.room.roomTypeId ?? roomTypes[0]?.id ?? null,
  );
  const [roomId, setRoomId] = useState<number | null>(
    selection?.room.id ?? null,
  );
  const [dateArrivee, setDateArrivee] = useState(
    selection?.dateArrivee ?? toISODate(new Date()),
  );
  const [dateDepart, setDateDepart] = useState(
    selection?.dateDepart ?? toISODate(addDays(new Date(), 1)),
  );
  const [formule, setFormule] =
    useState<FormuleHebergement>('BED_AND_BREAKFAST');
  const [prixEstime, setPrixEstime] = useState<string | null>(null);
  const [estimating, setEstimating] = useState(false);
  const [manualOverride, setManualOverride] = useState(false);
  const [manualPrixFinal, setManualPrixFinal] = useState('');
  const [motifAjustement, setMotifAjustement] = useState('');

  const roomsOfType = useMemo(
    () => rooms.filter((r) => r.roomTypeId === roomTypeId),
    [rooms, roomTypeId],
  );

  // CH-061 (Lot #3 design) — recalculé à chaque changement de type de
  // chambre/dates/formule, jamais côté client (mêmes règles de tarification
  // saisonnière que la création réelle, ReservationsService.calculatePrixTotal
  // côté serveur).
  useEffect(() => {
    if (
      !roomTypeId ||
      !dateArrivee ||
      !dateDepart ||
      dateArrivee >= dateDepart
    ) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPrixEstime(null);
      return;
    }
    let cancelled = false;
    setEstimating(true);
    estimatePrice({ roomTypeId, dateArrivee, dateDepart, formule })
      .then((res) => {
        if (!cancelled) setPrixEstime(res.prixEstime);
      })
      .catch(() => {
        if (!cancelled) setPrixEstime(null);
      })
      .finally(() => {
        if (!cancelled) setEstimating(false);
      });
    return () => {
      cancelled = true;
    };
  }, [roomTypeId, dateArrivee, dateDepart, formule]);

  // Valeur affichée/soumise du prix final : reflète le prix calculé tant
  // que l'ajustement manuel n'est pas coché (même comportement que le
  // mockup, où le champ désactivé affiche déjà le montant calculé) — dérivée
  // au rendu plutôt que synchronisée par effet, pas de second état à
  // recaler.
  const prixFinal = manualOverride ? manualPrixFinal : (prixEstime ?? '');

  function handleRoomTypeChange(nextRoomTypeId: number) {
    setRoomTypeId(nextRoomTypeId);
    if (
      !rooms.some((r) => r.roomTypeId === nextRoomTypeId && r.id === roomId)
    ) {
      const first = rooms.find((r) => r.roomTypeId === nextRoomTypeId);
      setRoomId(first?.id ?? null);
    }
  }

  function handleManualOverrideChange(checked: boolean) {
    setManualOverride(checked);
    if (checked && manualPrixFinal === '' && prixEstime !== null) {
      setManualPrixFinal(prixEstime);
    }
  }

  const selectedRoomType = roomTypes.find((rt) => rt.id === roomTypeId);
  const nights =
    dateArrivee && dateDepart && dateArrivee < dateDepart
      ? Math.round(
          (new Date(dateDepart).getTime() - new Date(dateArrivee).getTime()) /
            86_400_000,
        )
      : 0;

  const datesInvalides =
    !dateArrivee || !dateDepart || dateArrivee >= dateDepart;
  const motifInvalide = manualOverride && motifAjustement.trim().length < 10;
  const prixFinalInvalide =
    manualOverride && (prixFinal === '' || Number(prixFinal) < 0);
  const canSubmit =
    guestSelection !== null &&
    roomId !== null &&
    !datesInvalides &&
    !motifInvalide &&
    !prixFinalInvalide;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || !guestSelection || roomId === null) return;
    onConfirm({
      ...guestSelection,
      roomId,
      dateArrivee,
      dateDepart,
      canal,
      formule,
      ...(manualOverride
        ? {
            prixTotalFinal: Number(prixFinal),
            motifAjustement: motifAjustement.trim(),
          }
        : {}),
    });
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Nouvelle réservation</DialogTitle>
      </DialogHeader>
      <p className="text-muted-foreground -mt-2 text-sm">
        Canal, client, chambre et tarification en une seule fiche.
      </p>

      <form
        className="flex max-h-[70vh] flex-col gap-5 overflow-y-auto pr-1"
        onSubmit={handleSubmit}
      >
        <div className="flex flex-col gap-2">
          <span className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
            Canal
          </span>
          <div className="flex flex-wrap gap-2">
            {CANAL_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setCanal(option.value)}
                className={`rounded-md border px-4 py-1.5 text-xs font-semibold transition-colors ${
                  canal === option.value
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'text-muted-foreground hover:bg-muted border-input'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
            Client
          </span>
          <GuestPicker onChange={setGuestSelection} />
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
            Chambre &amp; dates
          </span>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="roomTypeId">Type de chambre</Label>
              <Select
                value={roomTypeId ? String(roomTypeId) : ''}
                onValueChange={(v) => v && handleRoomTypeChange(Number(v))}
              >
                <SelectTrigger id="roomTypeId" className="w-full">
                  <SelectValue>
                    {() =>
                      selectedRoomType
                        ? `${selectedRoomType.nom} — dès ${Number(selectedRoomType.prixBase).toFixed(0)} MAD/nuit`
                        : 'Sélectionner…'
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {roomTypes.map((rt) => (
                    <SelectItem key={rt.id} value={String(rt.id)}>
                      {rt.nom} — dès {Number(rt.prixBase).toFixed(0)} MAD/nuit
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="roomId">Chambre</Label>
              <Select
                value={roomId ? String(roomId) : ''}
                onValueChange={(v) => v && setRoomId(Number(v))}
              >
                <SelectTrigger id="roomId" className="w-full">
                  <SelectValue>
                    {() => {
                      const r = roomsOfType.find((x) => x.id === roomId);
                      return r
                        ? `${r.numero} — ${STATUT_LABEL[r.statut]}`
                        : 'Sélectionner…';
                    }}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {roomsOfType.map((r) => (
                    <SelectItem key={r.id} value={String(r.id)}>
                      {r.numero} — {STATUT_LABEL[r.statut]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="dateArrivee">Arrivée</Label>
              <Input
                id="dateArrivee"
                type="date"
                value={dateArrivee}
                onChange={(e) => setDateArrivee(e.target.value)}
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="dateDepart">Départ</Label>
              <Input
                id="dateDepart"
                type="date"
                value={dateDepart}
                onChange={(e) => setDateDepart(e.target.value)}
                required
              />
            </div>
          </div>
          {datesInvalides && dateArrivee && dateDepart && (
            <p className="text-destructive text-xs">
              La date de départ doit être postérieure à la date d'arrivée.
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
            Formule d'hébergement
          </span>
          <div className="grid grid-cols-4 gap-2">
            {FORMULE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setFormule(option.value)}
                className={`rounded-md border px-2 py-2 text-center text-xs font-semibold transition-colors ${
                  formule === option.value
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'text-muted-foreground hover:bg-muted border-input'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-muted/40 flex flex-col gap-2.5 rounded-lg border p-4">
          <span className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
            Tarification
          </span>
          {selectedRoomType && !datesInvalides && (
            <div className="text-muted-foreground flex justify-between text-xs">
              <span>
                {estimating
                  ? 'Calcul…'
                  : `${Number(selectedRoomType.prixBase).toFixed(0)} MAD × ${nights} nuit${nights > 1 ? 's' : ''} (${selectedRoomType.nom})`}
              </span>
              <span>
                {prixEstime !== null
                  ? `${Number(prixEstime).toFixed(2)} MAD`
                  : '—'}
              </span>
            </div>
          )}
          <div className="flex justify-between border-t pt-2 text-sm font-bold">
            <span>Prix calculé</span>
            <span>
              {estimating
                ? '…'
                : prixEstime !== null
                  ? `${Number(prixEstime).toFixed(2)} MAD`
                  : '—'}
            </span>
          </div>
          <label className="mt-1 flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={manualOverride}
              onChange={(e) => handleManualOverrideChange(e.target.checked)}
              className="size-4"
            />
            Ajustement manuel du prix final
          </label>
          <div className="grid grid-cols-[140px_1fr] items-end gap-2.5">
            <div className="flex flex-col gap-1">
              <Label htmlFor="prixFinal" className="text-xs font-normal">
                Prix final (MAD)
              </Label>
              <Input
                id="prixFinal"
                type="number"
                min="0"
                step="0.01"
                disabled={!manualOverride}
                value={prixFinal}
                onChange={(e) => setManualPrixFinal(e.target.value)}
                className="h-9"
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="motifAjustement" className="text-xs font-normal">
                Motif de l'ajustement (obligatoire si modifié)
              </Label>
              <Input
                id="motifAjustement"
                type="text"
                placeholder="Ex. Tarif négocié agence Voyages Atlas"
                disabled={!manualOverride}
                value={motifAjustement}
                onChange={(e) => setMotifAjustement(e.target.value)}
                className="h-9"
              />
            </div>
          </div>
          {motifInvalide && (
            <p className="text-destructive text-xs">
              Le motif doit comporter au moins 10 caractères.
            </p>
          )}
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
          <Button type="submit" disabled={submitting || !canSubmit}>
            {submitting ? 'Création…' : 'Créer la réservation'}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}
