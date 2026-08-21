import { useEffect, useRef, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/ui/error-state';
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
import type { CheckinGuestSummary, RoomAvailability } from '../types';
import { checkRoomAvailability, getCheckinGuest } from '../api';

// CH-061 (Lot #3 design) — même liste que CreateReservationDialog.
// COMMERCIAL-001C : ROOM_ONLY supprimé — interdit pour les nuitées.
const FORMULE_OPTIONS: { value: FormuleHebergement; label: string }[] = [
  { value: 'BED_AND_BREAKFAST', label: 'Petit-déjeuner (B&B)' },
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
      <DialogContent className="sm:max-w-2xl">
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
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [roomId, setRoomId] = useState('');
  const [dateCheckoutPrevue, setDateCheckoutPrevue] = useState('');
  const [formule, setFormule] =
    useState<FormuleHebergement>('BED_AND_BREAKFAST');
  // FIN-102 — jamais préremplie depuis room.roomType.capacite (interdiction
  // absolue, common/utils/occupancy.ts) : reste vide tant que la réception
  // n'a pas saisi l'occupation réelle.
  const [nombreOccupants, setNombreOccupants] = useState('');
  const [guestSelection, setGuestSelection] = useState<GuestSelection | null>(
    null,
  );
  const [guestSummary, setGuestSummary] = useState<CheckinGuestSummary | null>(
    null,
  );
  const [guestError, setGuestError] = useState<string | null>(null);
  const [prixEstime, setPrixEstime] = useState<string | null>(null);
  const [estimating, setEstimating] = useState(false);
  const [availability, setAvailability] = useState<RoomAvailability | null>(
    null,
  );
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [availabilityError, setAvailabilityError] = useState<string | null>(
    null,
  );
  const [availabilityRetry, setAvailabilityRetry] = useState(0);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const submitLockRef = useRef(false);

  const selectedRoom = rooms.find((room) => String(room.id) === roomId);
  const today = toISODate(new Date());
  // PRICING-001E — déclaré ici (avant les useEffect) pour être disponible
  // dans les dépendances de l'effet d'estimation (GAP-4).
  const nombreOccupantsNum =
    nombreOccupants === '' ? null : Number(nombreOccupants);

  useEffect(() => {
    headingRef.current?.focus();
  }, [step]);

  useEffect(() => {
    if (error) submitLockRef.current = false;
  }, [error]);

  useEffect(() => {
    if (!guestSelection || !('guestId' in guestSelection)) {
      return;
    }
    let cancelled = false;
    getCheckinGuest(guestSelection.guestId)
      .then((guest) => {
        if (!cancelled) setGuestSummary(guest);
      })
      .catch((reason) => {
        if (!cancelled) {
          setGuestError(
            reason instanceof Error
              ? reason.message
              : 'Impossible de charger le client',
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [guestSelection]);

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
        // PRICING-001E — nombreOccupantsNum transmis pour que le supplément
        // HB/FB soit correct dans l'aperçu walk-in (GAP-4).
        const res = await estimatePrice({
          roomTypeId: selectedRoom.roomTypeId,
          dateArrivee: today,
          dateDepart: dateCheckoutPrevue,
          formule,
          ...(nombreOccupantsNum !== null
            ? { nombreOccupants: nombreOccupantsNum }
            : {}),
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
  }, [selectedRoom, dateCheckoutPrevue, formule, nombreOccupantsNum, today]);

  useEffect(() => {
    if (!selectedRoom || !dateCheckoutPrevue || dateCheckoutPrevue <= today) {
      return;
    }
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (cancelled) return;
      setAvailabilityLoading(true);
      setAvailabilityError(null);
      setAvailability(null);
    });
    checkRoomAvailability({
      roomId: selectedRoom.id,
      dateArrivee: today,
      dateDepart: dateCheckoutPrevue,
    })
      .then((result) => {
        if (!cancelled) setAvailability(result);
      })
      .catch((reason) => {
        if (!cancelled) {
          setAvailabilityError(
            reason instanceof Error
              ? reason.message
              : 'Vérification indisponible',
          );
        }
      })
      .finally(() => {
        if (!cancelled) setAvailabilityLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [availabilityRetry, dateCheckoutPrevue, formule, selectedRoom, today]);

  function invalidateAvailability() {
    setAvailability(null);
    setAvailabilityError(null);
    setAvailabilityLoading(false);
  }

  function handleGuestChange(selection: GuestSelection | null) {
    setGuestSelection(selection);
    setGuestSummary(null);
    setGuestError(null);
  }

  const guestLabel = guestSelection
    ? 'guest' in guestSelection
      ? `${guestSelection.guest.prenom} ${guestSelection.guest.nom}`
      : guestSummary
        ? `${guestSummary.prenom} ${guestSummary.nom}`
        : 'Client existant sélectionné'
    : 'Aucun client';
  const datesValid = dateCheckoutPrevue > today;
  // FIN-102 — entier >= 1, jamais dérivé de selectedRoom.roomType.capacite
  // (interdiction absolue) : cette valeur ne sert qu'à borner la saisie, la
  // capacité elle-même n'est jamais une valeur par défaut silencieuse.
  const occupantsValid =
    nombreOccupantsNum !== null &&
    Number.isInteger(nombreOccupantsNum) &&
    nombreOccupantsNum >= 1 &&
    (selectedRoom === undefined ||
      nombreOccupantsNum <= selectedRoom.roomType.capacite);
  const canConfirm =
    guestSelection !== null &&
    selectedRoom !== undefined &&
    datesValid &&
    occupantsValid &&
    availability?.disponible === true &&
    prixEstime !== null &&
    !submitting;
  const stepValid =
    step === 1
      ? guestSelection !== null
      : step === 2
        ? selectedRoom !== undefined && datesValid && occupantsValid
        : canConfirm;

  return (
    <form
      className="flex flex-col gap-5"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        if (step < 3) {
          if (stepValid) setStep((step + 1) as 2 | 3);
          return;
        }
        if (
          !canConfirm ||
          !selectedRoom ||
          !guestSelection ||
          nombreOccupantsNum === null ||
          submitLockRef.current
        )
          return;
        submitLockRef.current = true;
        onConfirm({
          roomId: selectedRoom.id,
          dateCheckoutPrevue,
          formule,
          nombreOccupants: nombreOccupantsNum,
          ...guestSelection,
        });
      }}
    >
      <DialogHeader>
        <DialogTitle ref={headingRef} tabIndex={-1}>
          Check-in walk-in — étape {step} sur 3
        </DialogTitle>
      </DialogHeader>

      <nav aria-label="Étapes du walk-in" className="grid grid-cols-3 gap-2">
        {['Client', 'Chambre et séjour', 'Confirmation'].map((label, index) => {
          const number = (index + 1) as 1 | 2 | 3;
          return (
            <button
              key={label}
              type="button"
              aria-current={step === number ? 'step' : undefined}
              disabled={number > step}
              onClick={() => number < step && setStep(number)}
              className="border-border aria-current:border-primary aria-current:text-primary rounded-md border px-2 py-2 text-xs font-medium disabled:opacity-50"
            >
              {number}. {label}
            </button>
          );
        })}
      </nav>

      <section className={step === 1 ? 'flex flex-col gap-3' : 'hidden'}>
        <GuestPicker onChange={handleGuestChange} />
        {guestError && <p className="text-destructive text-sm">{guestError}</p>}
      </section>

      <section className={step === 2 ? 'flex flex-col gap-3' : 'hidden'}>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="room">Chambre</Label>
          <SelectSearch
            id="room"
            value={roomId}
            onValueChange={(value) => {
              invalidateAvailability();
              setRoomId(value);
            }}
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
            min={today}
            onChange={(event) => {
              invalidateAvailability();
              setDateCheckoutPrevue(event.target.value);
            }}
            required
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="nombreOccupants">Nombre d'occupants</Label>
          <Input
            id="nombreOccupants"
            type="number"
            min={1}
            max={selectedRoom?.roomType.capacite}
            value={nombreOccupants}
            onChange={(event) => setNombreOccupants(event.target.value)}
            required
          />
          {nombreOccupants !== '' && !occupantsValid && (
            <p className="text-destructive text-xs">
              {selectedRoom
                ? `Doit être un entier entre 1 et ${selectedRoom.roomType.capacite} (capacité de la chambre).`
                : 'Doit être un entier supérieur ou égal à 1.'}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="formule">Formule</Label>
          <Select
            value={formule}
            onValueChange={(value) => {
              if (!value) return;
              invalidateAvailability();
              setFormule(value as FormuleHebergement);
            }}
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
      </section>

      <section className={step === 3 ? 'flex flex-col gap-4' : 'hidden'}>
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {[
            ['Client', guestLabel],
            [
              'Chambre',
              selectedRoom
                ? `${selectedRoom.numero} — ${selectedRoom.roomType.nom}`
                : '—',
            ],
            ['Statut chambre', selectedRoom?.statut ?? '—'],
            ['Arrivée', today],
            ['Départ prévu', dateCheckoutPrevue || '—'],
            ["Nombre d'occupants", nombreOccupants || '—'],
            [
              'Formule',
              FORMULE_OPTIONS.find((option) => option.value === formule)
                ?.label ?? formule,
            ],
            [
              'Estimation',
              prixEstime !== null
                ? `${Number(prixEstime).toFixed(2)} MAD`
                : 'Indisponible',
            ],
          ].map(([label, value]) => (
            <div key={label} className="rounded-md border p-3">
              <dt className="text-muted-foreground text-xs">{label}</dt>
              <dd className="mt-1 text-sm font-medium">{value}</dd>
            </div>
          ))}
        </dl>

        {availabilityLoading ? (
          <p className="text-muted-foreground text-sm">Vérification…</p>
        ) : availabilityError ? (
          <ErrorState
            title="Disponibilité non vérifiée"
            description={availabilityError}
            onRetry={() => setAvailabilityRetry((value) => value + 1)}
          />
        ) : availability?.disponible ? (
          <p className="text-success text-sm">
            Vérification serveur positive. Le backend validera définitivement le
            check-in.
          </p>
        ) : (
          <p className="text-destructive text-sm">
            Chambre indisponible
            {availability?.motifIndisponibilite
              ? ` : ${availability.motifIndisponibilite}`
              : availability?.datesConflit.length
                ? ` : conflit sur ${availability.datesConflit.join(', ')}`
                : '.'}
          </p>
        )}

        {error && <p className="text-destructive text-sm">{error}</p>}
      </section>

      <DialogFooter className="flex-col-reverse gap-2 sm:flex-row">
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
          disabled={submitting}
        >
          Annuler
        </Button>
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
        <Button type="submit" disabled={!stepValid || submitting}>
          {step < 3
            ? 'Continuer'
            : submitting
              ? 'Enregistrement…'
              : 'Enregistrer le check-in'}
        </Button>
      </DialogFooter>
    </form>
  );
}
