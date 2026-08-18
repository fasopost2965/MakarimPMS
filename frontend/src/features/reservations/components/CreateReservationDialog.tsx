import { useEffect, useMemo, useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MoneyDisplay } from '@/components/ui/money-display';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { GuestPicker } from '@/features/guests/components/GuestPicker';
import type { GuestSelection } from '@/features/guests/components/GuestPicker';
import { cn } from '@/lib/utils';
import { estimatePrice } from '../api';
import { addDays, toISODate } from '../date-utils';
import type {
  CanalReservation,
  FormuleHebergement,
  Room,
  RoomType,
  StatutChambre,
} from '../types';
import { StepIndicator } from './StepIndicator';

export interface CreateReservationSelection {
  room: Room;
  dateArrivee: string;
  dateDepart: string;
}

export type CreateReservationConfirmInput = GuestSelection & {
  roomId: number;
  dateArrivee: string;
  dateDepart: string;
  canal: CanalReservation;
  formule: FormuleHebergement;
  nombreOccupants?: number;
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

const STEPS = ['Séjour', 'Client', 'Réservation', 'Confirmation'];
const CANAL_OPTIONS: { value: CanalReservation; label: string }[] = [
  { value: 'WALK_IN', label: 'Walk-in' },
  { value: 'DIRECT', label: 'Direct' },
  { value: 'BOOKING_COM', label: 'Booking.com' },
];
const FORMULE_OPTIONS: { value: FormuleHebergement; label: string }[] = [
  { value: 'ROOM_ONLY', label: 'Logement seul' },
  { value: 'BED_AND_BREAKFAST', label: 'Petit-déjeuner' },
  { value: 'HALF_BOARD', label: 'Demi-pension' },
  { value: 'FULL_BOARD', label: 'Pension complète' },
];
const STATUT_LABEL: Record<StatutChambre, string> = {
  LIBRE_PROPRE: 'libre',
  RESERVEE: 'réservée',
  OCCUPEE: 'occupée',
  DEPART_PREVU: 'départ prévu',
  A_NETTOYER: 'à nettoyer',
  EN_NETTOYAGE: 'en nettoyage',
  EN_MAINTENANCE: 'en maintenance',
};

export function CreateReservationDialog(props: Props) {
  return (
    <Dialog open={props.open} onOpenChange={(next) => !next && props.onClose()}>
      <DialogContent className="flex max-h-[calc(100dvh-1rem)] flex-col p-0 sm:max-w-3xl">
        {props.open && (
          <ReservationForm
            key={
              props.selection
                ? `${props.selection.room.id}-${props.selection.dateArrivee}-${props.selection.dateDepart}`
                : 'manual'
            }
            {...props}
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
}: Props) {
  const roomTypes = useMemo(() => {
    const map = new Map<number, RoomType>();
    rooms.forEach((room) => map.set(room.roomTypeId, room.roomType));
    return [...map.values()];
  }, [rooms]);
  const [step, setStep] = useState(0);
  const [canal, setCanal] = useState<CanalReservation>('WALK_IN');
  const [guestSelection, setGuestSelection] = useState<GuestSelection | null>(
    null,
  );
  const [roomTypeId, setRoomTypeId] = useState<number | null>(
    selection?.room.roomTypeId ?? roomTypes[0]?.id ?? null,
  );
  const [roomId, setRoomId] = useState<number | null>(
    selection?.room.id ?? rooms[0]?.id ?? null,
  );
  const [dateArrivee, setDateArrivee] = useState(
    selection?.dateArrivee ?? toISODate(new Date()),
  );
  const [dateDepart, setDateDepart] = useState(
    selection?.dateDepart ?? toISODate(addDays(new Date(), 1)),
  );
  const [formule, setFormule] =
    useState<FormuleHebergement>('BED_AND_BREAKFAST');
  const [nombreOccupants, setNombreOccupants] = useState('');
  const [prixEstime, setPrixEstime] = useState<string | null>(null);
  const [estimating, setEstimating] = useState(false);
  const [manualOverride, setManualOverride] = useState(false);
  const [manualPrixFinal, setManualPrixFinal] = useState('');
  const [motifAjustement, setMotifAjustement] = useState('');

  const roomsOfType = useMemo(
    () => rooms.filter((room) => room.roomTypeId === roomTypeId),
    [rooms, roomTypeId],
  );
  const selectedRoomType = roomTypes.find((type) => type.id === roomTypeId);
  const selectedRoom = rooms.find((room) => room.id === roomId);
  const nights =
    dateArrivee && dateDepart && dateArrivee < dateDepart
      ? Math.round(
          (new Date(dateDepart).getTime() - new Date(dateArrivee).getTime()) /
            86_400_000,
        )
      : 0;
  const datesInvalides =
    !dateArrivee || !dateDepart || dateArrivee >= dateDepart;
  const nombreOccupantsNum =
    nombreOccupants === '' ? null : Number(nombreOccupants);
  // PRICING-001E — occupants obligatoires pour HB/FB (règle métier) :
  // la règle backend (ValidateIf) est désormais miroir côté frontend pour
  // bloquer le submit avant même l'appel réseau.
  const FORMULES_AVEC_OCCUPANTS_OBLIGATOIRES: FormuleHebergement[] = [
    'HALF_BOARD',
    'FULL_BOARD',
  ];
  const occupantsObligatoires =
    FORMULES_AVEC_OCCUPANTS_OBLIGATOIRES.includes(formule);
  const occupantsManquants =
    occupantsObligatoires && nombreOccupantsNum === null;
  const occupantsInvalides =
    nombreOccupants !== '' &&
    (!Number.isInteger(nombreOccupantsNum) ||
      Number(nombreOccupantsNum) < 1 ||
      (selectedRoomType &&
        Number(nombreOccupantsNum) > selectedRoomType.capacite));
  const motifInvalide = manualOverride && motifAjustement.trim().length < 10;
  const prixFinal = manualOverride ? manualPrixFinal : (prixEstime ?? '');
  const prixInvalide =
    manualOverride && (prixFinal === '' || Number(prixFinal) < 0);

  useEffect(() => {
    if (!roomTypeId || datesInvalides) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPrixEstime(null);
      return;
    }
    let cancelled = false;
    setEstimating(true);
    // PRICING-001E — nombreOccupantsNum transmis pour que le supplément
    // HB/FB soit correctement calculé dès sa saisie (GAP-1 & GAP-3).
    estimatePrice({
      roomTypeId,
      dateArrivee,
      dateDepart,
      formule,
      ...(nombreOccupantsNum !== null
        ? { nombreOccupants: nombreOccupantsNum }
        : {}),
    })
      .then((result) => !cancelled && setPrixEstime(result.prixEstime))
      .catch(() => !cancelled && setPrixEstime(null))
      .finally(() => !cancelled && setEstimating(false));
    return () => {
      cancelled = true;
    };
    // nombreOccupantsNum intentionnellement dans les dépendances :
    // un changement d'occupants rafraîchit l'estimation (GAP-3).
  }, [
    roomTypeId,
    dateArrivee,
    dateDepart,
    formule,
    nombreOccupantsNum,
    datesInvalides,
  ]);

  function changeRoomType(next: number) {
    setRoomTypeId(next);
    if (!rooms.some((room) => room.roomTypeId === next && room.id === roomId)) {
      setRoomId(rooms.find((room) => room.roomTypeId === next)?.id ?? null);
    }
  }

  const stepValid = [
    roomId !== null && !datesInvalides,
    guestSelection !== null,
    // PRICING-001E — occupantsManquants bloque step 2 si HB/FB sans occupants
    !occupantsManquants &&
      !occupantsInvalides &&
      !motifInvalide &&
      !prixInvalide,
    true,
  ];
  const canSubmit = stepValid.slice(0, 3).every(Boolean);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (step !== 3 || !canSubmit || !guestSelection || roomId === null) return;
    onConfirm({
      ...guestSelection,
      roomId,
      dateArrivee,
      dateDepart,
      canal,
      formule,
      ...(nombreOccupantsNum !== null
        ? { nombreOccupants: nombreOccupantsNum }
        : {}),
      ...(manualOverride
        ? {
            prixTotalFinal: Number(prixFinal),
            motifAjustement: motifAjustement.trim(),
          }
        : {}),
    });
  }

  return (
    <form className="flex min-h-0 flex-1 flex-col" onSubmit={submit}>
      <div className="border-b px-4 pt-4 pb-3 sm:px-6">
        <DialogHeader>
          <DialogTitle>Nouvelle réservation</DialogTitle>
        </DialogHeader>
        <p className="text-text-secondary mt-1 text-sm">
          Une création guidée, fondée sur les disponibilités et tarifs réels.
        </p>
        <StepIndicator steps={STEPS} current={step} onStep={setStep} />
      </div>

      <div
        className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6"
        data-testid="reservation-wizard-fields"
      >
        {selection && step === 0 && (
          <Alert
            className="mb-4"
            title="Prérempli depuis le planning"
            description={`Chambre ${selection.room.numero}, du ${selection.dateArrivee} au ${selection.dateDepart}.`}
          />
        )}

        {step === 0 && (
          <section aria-labelledby="wizard-stay" className="space-y-4">
            <h2 id="wizard-stay" className="text-base font-bold">
              Séjour et chambre
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Type de chambre" id="roomTypeId">
                <Select
                  value={roomTypeId ? String(roomTypeId) : ''}
                  onValueChange={(value) =>
                    value && changeRoomType(Number(value))
                  }
                >
                  <SelectTrigger id="roomTypeId" className="w-full">
                    <SelectValue>
                      {() =>
                        selectedRoomType
                          ? `${selectedRoomType.nom} · ${Number(selectedRoomType.prixBase).toFixed(0)} MAD/nuit`
                          : 'Sélectionner…'
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {roomTypes.map((type) => (
                      <SelectItem key={type.id} value={String(type.id)}>
                        {type.nom} · {Number(type.prixBase).toFixed(0)} MAD/nuit
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Chambre" id="roomId">
                <Select
                  value={roomId ? String(roomId) : ''}
                  onValueChange={(value) => value && setRoomId(Number(value))}
                >
                  <SelectTrigger id="roomId" className="w-full">
                    <SelectValue>
                      {() =>
                        selectedRoom
                          ? `${selectedRoom.numero} · ${STATUT_LABEL[selectedRoom.statut]}`
                          : 'Sélectionner…'
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {roomsOfType.map((room) => (
                      <SelectItem key={room.id} value={String(room.id)}>
                        {room.numero} · {STATUT_LABEL[room.statut]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Arrivée" id="dateArrivee">
                <Input
                  id="dateArrivee"
                  type="date"
                  value={dateArrivee}
                  onChange={(e) => setDateArrivee(e.target.value)}
                  required
                />
              </Field>
              <Field label="Départ" id="dateDepart">
                <Input
                  id="dateDepart"
                  type="date"
                  value={dateDepart}
                  onChange={(e) => setDateDepart(e.target.value)}
                  required
                />
              </Field>
            </div>
            {datesInvalides && (
              <p className="text-destructive text-sm">
                La date de départ doit être postérieure à la date d’arrivée.
              </p>
            )}
            <Card className="bg-surface-2/60">
              <CardContent className="flex-row items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold">Estimation serveur</p>
                  <p className="text-text-secondary text-xs">
                    {nights} nuit{nights > 1 ? 's' : ''} ·{' '}
                    {selectedRoomType?.nom ?? 'chambre à choisir'}
                  </p>
                </div>
                {estimating ? (
                  <span className="text-text-secondary text-sm">Calcul…</span>
                ) : prixEstime ? (
                  <MoneyDisplay value={prixEstime} />
                ) : (
                  <span>—</span>
                )}
              </CardContent>
            </Card>
          </section>
        )}

        {step === 1 && (
          <section aria-labelledby="wizard-guest" className="space-y-4">
            <div>
              <h2 id="wizard-guest" className="text-base font-bold">
                Client
              </h2>
              <p className="text-text-secondary text-sm">
                Retrouvez un client existant ou créez sa fiche sans quitter la
                réservation.
              </p>
            </div>
            <GuestPicker onChange={setGuestSelection} />
          </section>
        )}

        {step === 2 && (
          <section aria-labelledby="wizard-booking" className="space-y-5">
            <h2 id="wizard-booking" className="text-base font-bold">
              Informations de réservation
            </h2>
            <ChoiceGroup
              label="Canal"
              options={CANAL_OPTIONS}
              value={canal}
              onChange={(value) => setCanal(value as CanalReservation)}
            />
            <ChoiceGroup
              label="Formule"
              options={FORMULE_OPTIONS}
              value={formule}
              onChange={(value) => setFormule(value as FormuleHebergement)}
            />
            {/* PRICING-001E — label conditionnel : obligatoire pour HB/FB */}
            <Field
              label={
                occupantsObligatoires
                  ? "Nombre d'occupants"
                  : "Nombre d'occupants (optionnel)"
              }
              id="nombreOccupants"
            >
              <Input
                id="nombreOccupants"
                type="number"
                min={1}
                max={selectedRoomType?.capacite}
                value={nombreOccupants}
                onChange={(e) => setNombreOccupants(e.target.value)}
                required={occupantsObligatoires}
                aria-required={occupantsObligatoires}
              />
            </Field>
            {occupantsManquants && (
              <p className="text-destructive text-sm" role="alert">
                Le nombre d&apos;occupants est obligatoire pour la formule{' '}
                {formule === 'HALF_BOARD' ? 'demi-pension' : 'pension complète'}
                .
              </p>
            )}
            {occupantsInvalides && (
              <p className="text-destructive text-sm">
                Saisissez un entier entre 1 et{' '}
                {selectedRoomType?.capacite ?? 'la capacité autorisée'}.
              </p>
            )}
            <Card className="bg-surface-2/60">
              <CardContent className="gap-3">
                <label className="flex min-h-11 items-center gap-3 text-sm font-semibold">
                  <input
                    type="checkbox"
                    checked={manualOverride}
                    onChange={(e) => {
                      setManualOverride(e.target.checked);
                      if (e.target.checked && !manualPrixFinal && prixEstime)
                        setManualPrixFinal(prixEstime);
                    }}
                    className="size-5"
                  />
                  Ajustement manuel du prix final
                </label>
                {manualOverride && (
                  <div className="grid gap-3 sm:grid-cols-[180px_1fr]">
                    <Field label="Prix final (MAD)" id="prixFinal">
                      <Input
                        id="prixFinal"
                        type="number"
                        min="0"
                        step="0.01"
                        value={prixFinal}
                        onChange={(e) => setManualPrixFinal(e.target.value)}
                      />
                    </Field>
                    <Field
                      label="Motif (10 caractères minimum)"
                      id="motifAjustement"
                    >
                      <Input
                        id="motifAjustement"
                        value={motifAjustement}
                        onChange={(e) => setMotifAjustement(e.target.value)}
                      />
                    </Field>
                  </div>
                )}
                {(motifInvalide || prixInvalide) && (
                  <p className="text-destructive text-sm">
                    Le prix doit être positif et le motif comporter au moins 10
                    caractères.
                  </p>
                )}
              </CardContent>
            </Card>
          </section>
        )}

        {step === 3 && (
          <section aria-labelledby="wizard-confirm" className="space-y-4">
            <div>
              <h2 id="wizard-confirm" className="text-base font-bold">
                Vérification
              </h2>
              <p className="text-text-secondary text-sm">
                Contrôlez les informations avant la création définitive.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Summary title="Séjour" onEdit={() => setStep(0)}>
                {dateArrivee} → {dateDepart}
                <br />
                Chambre {selectedRoom?.numero} · {selectedRoomType?.nom}
              </Summary>
              <Summary title="Client" onEdit={() => setStep(1)}>
                {guestSelection && 'guestId' in guestSelection
                  ? `Client existant #${guestSelection.guestId}`
                  : guestSelection
                    ? `${guestSelection.guest.nom} ${guestSelection.guest.prenom}`
                    : 'Non renseigné'}
              </Summary>
              <Summary title="Réservation" onEdit={() => setStep(2)}>
                {CANAL_OPTIONS.find((item) => item.value === canal)?.label}
                <br />
                {FORMULE_OPTIONS.find((item) => item.value === formule)?.label}
                {nombreOccupantsNum
                  ? ` · ${nombreOccupantsNum} occupant(s)`
                  : ''}
              </Summary>
              <Summary title="Total" onEdit={() => setStep(2)}>
                {prixFinal ? (
                  <MoneyDisplay value={prixFinal} />
                ) : (
                  'Calcul indisponible'
                )}
              </Summary>
            </div>
          </section>
        )}
        {error && (
          <Alert
            className="mt-4"
            tone="destructive"
            title="La réservation n’a pas été créée"
            description={error}
          />
        )}
      </div>

      <DialogFooter className="border-t bg-surface px-4 py-3 sm:px-6">
        <Button
          type="button"
          variant="outline"
          onClick={step === 0 ? onClose : () => setStep((value) => value - 1)}
          disabled={submitting}
        >
          {step === 0 ? 'Annuler' : 'Retour'}
        </Button>
        {step < 3 ? (
          <Button
            type="button"
            onClick={(event) => {
              event.preventDefault();
              if (stepValid[step]) setStep((value) => value + 1);
            }}
            disabled={!stepValid[step]}
          >
            Continuer
          </Button>
        ) : (
          <Button type="submit" disabled={submitting || !canSubmit}>
            {submitting ? 'Création…' : 'Créer la réservation'}
          </Button>
        )}
      </DialogFooter>
    </form>
  );
}

function Field({
  label,
  id,
  children,
}: {
  label: string;
  id: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}

function ChoiceGroup({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-semibold">{label}</legend>
      <div className="grid gap-2 sm:grid-cols-3">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={value === option.value}
            onClick={() => onChange(option.value)}
            className={cn(
              'min-h-11 rounded-md border px-3 py-2 text-sm font-semibold transition-colors duration-[var(--duration-fast)] focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
              value === option.value
                ? 'border-primary bg-primary-soft text-primary'
                : 'border-border bg-surface text-text-secondary hover:bg-surface-2',
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

function Summary({
  title,
  onEdit,
  children,
}: {
  title: string;
  onEdit: () => void;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="gap-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold">{title}</h3>
          <Button type="button" variant="ghost" size="sm" onClick={onEdit}>
            Modifier
          </Button>
        </div>
        <div className="text-text-secondary text-sm">{children}</div>
      </CardContent>
    </Card>
  );
}
