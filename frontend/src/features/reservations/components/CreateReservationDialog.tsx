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
import {
  checkRoomAvailability,
  estimatePrice,
  listAvailableRooms,
} from '../api';
import { addDays, toISODate } from '../date-utils';
import type {
  CanalReservation,
  FormuleHebergement,
  Room,
  RoomAvailability,
  ReservationPriceEstimate,
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
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [guestSelection, setGuestSelection] = useState<GuestSelection | null>(
    null,
  );
  const [guestDisplay, setGuestDisplay] = useState<string | null>(null);
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
  const [priceEstimate, setPriceEstimate] =
    useState<ReservationPriceEstimate | null>(null);
  const [estimating, setEstimating] = useState(false);
  const [estimationError, setEstimationError] = useState<string | null>(null);
  const [availableRooms, setAvailableRooms] = useState<Room[]>([]);
  const [roomAvailability, setRoomAvailability] =
    useState<RoomAvailability | null>(null);
  const [checkingAvailability, setCheckingAvailability] = useState(false);
  const [availabilityError, setAvailabilityError] = useState<string | null>(
    null,
  );
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
      setPriceEstimate(null);
      setEstimationError(null);
      return;
    }
    let cancelled = false;
    setEstimating(true);
    setEstimationError(null);
    estimatePrice({ roomTypeId, dateArrivee, dateDepart, formule })
      .then((res) => {
        if (!cancelled) setPriceEstimate(res);
      })
      .catch((err) => {
        if (!cancelled) {
          setPriceEstimate(null);
          setEstimationError(
            err instanceof Error ? err.message : "Erreur d'estimation",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setEstimating(false);
      });
    return () => {
      cancelled = true;
    };
  }, [roomTypeId, dateArrivee, dateDepart, formule]);

  useEffect(() => {
    if (
      !roomTypeId ||
      !roomId ||
      !dateArrivee ||
      !dateDepart ||
      dateArrivee >= dateDepart
    ) {
      return;
    }

    let cancelled = false;
    // L'effet pilote une requête serveur externe ; cet état en expose le cycle.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCheckingAvailability(true);
    setAvailabilityError(null);
    Promise.all([
      listAvailableRooms({ dateArrivee, dateDepart, roomTypeId }),
      checkRoomAvailability({ roomId, dateArrivee, dateDepart }),
    ])
      .then(([available, selectedAvailability]) => {
        if (!cancelled) {
          setAvailableRooms(available);
          setRoomAvailability(selectedAvailability);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setAvailableRooms([]);
          setRoomAvailability(null);
          setAvailabilityError(
            err instanceof Error
              ? err.message
              : 'Erreur de vérification de disponibilité',
          );
        }
      })
      .finally(() => {
        if (!cancelled) setCheckingAvailability(false);
      });

    return () => {
      cancelled = true;
    };
  }, [dateArrivee, dateDepart, roomId, roomTypeId]);

  // Valeur affichée/soumise du prix final : reflète le prix calculé tant
  // que l'ajustement manuel n'est pas coché (même comportement que le
  // mockup, où le champ désactivé affiche déjà le montant calculé) — dérivée
  // au rendu plutôt que synchronisée par effet, pas de second état à
  // recaler.
  const prixEstime = priceEstimate?.prixEstime ?? null;
  const prixFinal = manualOverride ? manualPrixFinal : (prixEstime ?? '');

  function invalidateAvailability() {
    setAvailableRooms([]);
    setRoomAvailability(null);
    setAvailabilityError(null);
    setCheckingAvailability(false);
  }

  function handleRoomTypeChange(nextRoomTypeId: number) {
    invalidateAvailability();
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
    !prixFinalInvalide &&
    roomAvailability?.disponible === true &&
    priceEstimate !== null;

  const stepValid =
    step === 1
      ? guestSelection !== null
      : step === 2
        ? roomId !== null && !datesInvalides
        : canSubmit;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (step < 3) {
      if (stepValid) setStep((step + 1) as 2 | 3);
      return;
    }
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
        Un parcours guidé en trois étapes, sans perte des informations saisies.
      </p>

      <ol className="grid grid-cols-3 gap-2" aria-label="Étapes de création">
        {[
          { number: 1 as const, label: 'Client' },
          { number: 2 as const, label: 'Séjour' },
          { number: 3 as const, label: 'Confirmation' },
        ].map((item) => (
          <li key={item.number}>
            <button
              type="button"
              className={`flex w-full items-center gap-2 rounded-md border p-2 text-left text-xs transition-colors ${
                step === item.number
                  ? 'border-primary bg-primary/10 text-primary'
                  : item.number < step
                    ? 'border-border hover:bg-muted'
                    : 'border-border text-muted-foreground'
              }`}
              onClick={() => item.number < step && setStep(item.number)}
              disabled={item.number > step}
              aria-current={step === item.number ? 'step' : undefined}
            >
              <span className="bg-muted flex size-6 shrink-0 items-center justify-center rounded-full font-bold">
                {item.number}
              </span>
              <span className="hidden sm:inline">{item.label}</span>
            </button>
          </li>
        ))}
      </ol>

      <form
        className="flex max-h-[70vh] flex-col gap-5 overflow-y-auto pr-1"
        onSubmit={handleSubmit}
      >
        <div className={step === 1 ? 'flex flex-col gap-5' : 'hidden'}>
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
            <GuestPicker
              onChange={setGuestSelection}
              onDisplayChange={setGuestDisplay}
            />
          </div>
        </div>

        <div className={step === 2 ? 'flex flex-col gap-5' : 'hidden'}>
          <div className="flex flex-col gap-2">
            <span className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
              Chambre &amp; dates
            </span>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
                  onValueChange={(v) => {
                    if (!v) return;
                    invalidateAvailability();
                    setRoomId(Number(v));
                  }}
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
                      <SelectItem
                        key={r.id}
                        value={String(r.id)}
                        disabled={
                          !checkingAvailability &&
                          availableRooms.length > 0 &&
                          !availableRooms.some(
                            (available) => available.id === r.id,
                          )
                        }
                      >
                        {r.numero} — {STATUT_LABEL[r.statut]}
                        {!checkingAvailability &&
                        availableRooms.length > 0 &&
                        !availableRooms.some(
                          (available) => available.id === r.id,
                        )
                          ? ' — indisponible'
                          : ''}
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
                  onChange={(e) => {
                    invalidateAvailability();
                    setDateArrivee(e.target.value);
                  }}
                  required
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="dateDepart">Départ</Label>
                <Input
                  id="dateDepart"
                  type="date"
                  value={dateDepart}
                  onChange={(e) => {
                    invalidateAvailability();
                    setDateDepart(e.target.value);
                  }}
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
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
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
        </div>

        <div className={step === 3 ? 'flex flex-col gap-5' : 'hidden'}>
          <div className="flex flex-col gap-2">
            <span className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
              Disponibilité
            </span>
            <div className="bg-muted/40 rounded-lg border p-4 text-sm">
              {checkingAvailability ? (
                <p className="text-muted-foreground">Vérification en cours…</p>
              ) : availabilityError ? (
                <p className="text-destructive" role="alert">
                  {availabilityError}
                </p>
              ) : roomAvailability?.disponible ? (
                <div className="flex flex-col gap-1">
                  <p className="text-success font-semibold">
                    Chambre confirmée disponible par le serveur
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {availableRooms.length} chambre
                    {availableRooms.length > 1 ? 's' : ''} disponible
                    {availableRooms.length > 1 ? 's' : ''} pour ce type et ces
                    dates. La création reste l’arbitre final.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-1">
                  <p className="text-destructive font-semibold">
                    Chambre indisponible
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {roomAvailability?.motifIndisponibilite ??
                      (roomAvailability?.datesConflit.length
                        ? `Conflit sur : ${roomAvailability.datesConflit.join(', ')}`
                        : 'Revenez à l’étape précédente pour choisir une autre chambre.')}
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="bg-muted/40 flex flex-col gap-2.5 rounded-lg border p-4">
            <span className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
              Tarification
            </span>
            {estimating ? (
              <p className="text-muted-foreground text-xs">Calcul en cours…</p>
            ) : estimationError ? (
              <p className="text-destructive text-xs" role="alert">
                {estimationError}
              </p>
            ) : priceEstimate ? (
              <div className="flex flex-col gap-2 text-xs">
                <div className="text-muted-foreground flex justify-between gap-3">
                  <span>
                    Hébergement ({priceEstimate.detail.nombreNuits} nuitées)
                  </span>
                  <span>
                    {Number(priceEstimate.detail.hebergement).toFixed(2)} MAD
                  </span>
                </div>
                <div className="text-muted-foreground flex justify-between gap-3">
                  <span>Supplément formule</span>
                  <span>
                    {Number(priceEstimate.detail.supplementFormule).toFixed(2)}{' '}
                    MAD
                  </span>
                </div>
              </div>
            ) : null}
            <div className="flex justify-between border-t pt-2 text-sm font-bold">
              <span>Total estimé</span>
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
                <Label
                  htmlFor="motifAjustement"
                  className="text-xs font-normal"
                >
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

          <div className="flex flex-col gap-2 rounded-lg border p-4 text-sm">
            <span className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
              Résumé de la réservation
            </span>
            <dl className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-2">
              <dt className="text-muted-foreground">Client</dt>
              <dd className="text-right font-medium">
                {guestDisplay ?? 'Client sélectionné'}
              </dd>
              <dt className="text-muted-foreground">Canal</dt>
              <dd className="text-right font-medium">
                {CANAL_OPTIONS.find((option) => option.value === canal)?.label}
              </dd>
              <dt className="text-muted-foreground">Chambre</dt>
              <dd className="text-right font-medium">
                {rooms.find((room) => room.id === roomId)?.numero ?? '—'} —{' '}
                {selectedRoomType?.nom ?? '—'}
              </dd>
              <dt className="text-muted-foreground">Dates</dt>
              <dd className="text-right font-medium">
                {dateArrivee} → {dateDepart} ({nights} nuit
                {nights > 1 ? 's' : ''})
              </dd>
              <dt className="text-muted-foreground">Formule</dt>
              <dd className="text-right font-medium">
                {
                  FORMULE_OPTIONS.find((option) => option.value === formule)
                    ?.label
                }
              </dd>
              <dt className="text-muted-foreground">Total estimé</dt>
              <dd className="text-right font-medium">
                {prixEstime !== null
                  ? `${Number(prixEstime).toFixed(2)} MAD`
                  : '—'}
              </dd>
              {manualOverride && (
                <>
                  <dt className="text-muted-foreground">Prix final manuel</dt>
                  <dd className="text-right font-medium">
                    {prixFinal ? `${Number(prixFinal).toFixed(2)} MAD` : '—'}
                  </dd>
                  <dt className="text-muted-foreground">Écart</dt>
                  <dd className="text-right font-medium">
                    {prixEstime !== null && prixFinal
                      ? `${(Number(prixFinal) - Number(prixEstime)).toFixed(2)} MAD`
                      : '—'}
                  </dd>
                </>
              )}
            </dl>
            <p className="text-muted-foreground border-t pt-2 text-xs">
              Estimation d’hébergement avant facturation. Les taxes applicables
              sont calculées ultérieurement par le module Facturation.
            </p>
          </div>
        </div>

        {error && <p className="text-destructive text-sm">{error}</p>}

        <DialogFooter>
          {step > 1 && (
            <Button
              type="button"
              variant="outline"
              onClick={() => setStep((step - 1) as 1 | 2)}
              disabled={submitting}
            >
              Précédent
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={submitting}
          >
            Annuler
          </Button>
          <Button type="submit" disabled={submitting || !stepValid}>
            {submitting
              ? 'Création…'
              : step < 3
                ? 'Continuer'
                : 'Créer la réservation'}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}
