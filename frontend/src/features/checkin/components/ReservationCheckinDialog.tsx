import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ErrorState } from '@/components/ui/error-state';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { Reservation, Room } from '@/features/reservations/types';
import { checkRoomAvailability, listReservationDeposits } from '../api';
import type {
  CategorieClient,
  ReservationDeposit,
  RoomAvailability,
} from '../types';

type CheckinReservation = Reservation & {
  guest: Reservation['guest'] & {
    nationalite?: string | null;
    categorie?: CategorieClient;
    preferences?: string | null;
  };
  formule?: 'ROOM_ONLY' | 'BED_AND_BREAKFAST' | 'HALF_BOARD' | 'FULL_BOARD';
};

interface Props {
  reservation: CheckinReservation | null;
  roomStatus: Room['statut'] | null;
  permissions: string[] | null;
  onClose: () => void;
  // FIN-102 — nombreOccupants toujours transmis explicitement à la
  // confirmation (repris de la réservation si déjà connu, sinon saisi ici),
  // jamais un appel sans paramètre.
  onConfirm: (nombreOccupants: number) => void;
  submitting: boolean;
  error: string | null;
}

const FORMULE_LABEL: Record<string, string> = {
  ROOM_ONLY: 'Logement seul',
  BED_AND_BREAKFAST: 'Petit-déjeuner',
  HALF_BOARD: 'Demi-pension',
  FULL_BOARD: 'Pension complète',
};

const DEPOSIT_STATUS_LABEL: Record<ReservationDeposit['statut'], string> = {
  EN_ATTENTE: 'En attente',
  ENCAISSE: 'Encaissé',
  IMPUTE: 'Imputé',
  REMBOURSE: 'Remboursé',
};

export function ReservationCheckinDialog(props: Props) {
  return (
    <Dialog
      open={props.reservation !== null}
      onOpenChange={(next) => !next && props.onClose()}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        {props.reservation && (
          <ReservationCheckinForm {...props} reservation={props.reservation} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function ReservationCheckinForm({
  reservation,
  roomStatus,
  permissions,
  onClose,
  onConfirm,
  submitting,
  error,
}: Props & { reservation: CheckinReservation }) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [availability, setAvailability] = useState<RoomAvailability | null>(
    null,
  );
  const [availabilityLoading, setAvailabilityLoading] = useState(true);
  const [availabilityError, setAvailabilityError] = useState<string | null>(
    null,
  );
  const [availabilityRetry, setAvailabilityRetry] = useState(0);
  const [deposits, setDeposits] = useState<ReservationDeposit[]>([]);
  const [depositsLoading, setDepositsLoading] = useState(false);
  const [depositsError, setDepositsError] = useState<string | null>(null);
  const [depositsRetry, setDepositsRetry] = useState(0);
  // FIN-102 — préremplie si la réservation porte déjà nombreOccupants,
  // sinon vide (réservation legacy) : jamais dérivée de
  // reservation.room.roomType.capacite (interdiction absolue,
  // common/utils/occupancy.ts).
  const [nombreOccupants, setNombreOccupants] = useState(
    reservation.nombreOccupants !== null
      ? String(reservation.nombreOccupants)
      : '',
  );
  const headingRef = useRef<HTMLHeadingElement>(null);
  const submitLockRef = useRef(false);
  const canReadPayments = permissions?.includes('payments:read') ?? false;
  const isBlacklisted = reservation.guest.categorie === 'BLACKLIST';

  useEffect(() => {
    headingRef.current?.focus();
  }, [step]);

  useEffect(() => {
    if (error) submitLockRef.current = false;
  }, [error]);

  useEffect(() => {
    let cancelled = false;
    // Cette synchronisation expose le cycle de la requête serveur.
    void Promise.resolve().then(() => {
      if (cancelled) return;
      setAvailabilityLoading(true);
      setAvailabilityError(null);
      setAvailability(null);
    });
    checkRoomAvailability({
      roomId: reservation.roomId,
      dateArrivee: reservation.dateArrivee,
      dateDepart: reservation.dateDepart,
      excludeReservationId: reservation.id,
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
  }, [availabilityRetry, reservation]);

  useEffect(() => {
    if (!canReadPayments) return;
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (cancelled) return;
      setDepositsLoading(true);
      setDepositsError(null);
    });
    listReservationDeposits(reservation.id)
      .then((result) => {
        if (!cancelled) setDeposits(result);
      })
      .catch((reason) => {
        if (!cancelled) {
          setDepositsError(
            reason instanceof Error ? reason.message : 'Erreur des acomptes',
          );
        }
      })
      .finally(() => {
        if (!cancelled) setDepositsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [canReadPayments, depositsRetry, reservation.id]);

  const nights = Math.max(
    0,
    Math.round(
      (new Date(reservation.dateDepart).getTime() -
        new Date(reservation.dateArrivee).getTime()) /
        86_400_000,
    ),
  );
  const nombreOccupantsNum =
    nombreOccupants === '' ? null : Number(nombreOccupants);
  const capacite = reservation.room.roomType.capacite;
  const occupantsValid =
    nombreOccupantsNum !== null &&
    Number.isInteger(nombreOccupantsNum) &&
    nombreOccupantsNum >= 1 &&
    nombreOccupantsNum <= capacite;
  const canConfirm =
    !isBlacklisted &&
    occupantsValid &&
    availability?.disponible === true &&
    !submitting;

  function nextStep() {
    setStep((current) => Math.min(3, current + 1) as 1 | 2 | 3);
  }

  return (
    <form
      className="flex flex-col gap-5"
      // FIN-102 — nécessaire depuis l'ajout du champ "Nombre d'occupants"
      // (required) à l'étape 2 : ce champ reste monté (seulement masqué en
      // CSS, comme le reste des sections par étape) tant que l'étape 1 est
      // active, et la validation HTML5 native du navigateur bloquerait
      // sinon toute soumission du formulaire (y compris "Continuer" à
      // l'étape 1) tant qu'il est vide — même précédent que
      // WalkinCheckinDialog, qui pose déjà `noValidate` pour cette raison.
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        if (step < 3) {
          nextStep();
          return;
        }
        if (
          canConfirm &&
          nombreOccupantsNum !== null &&
          !submitLockRef.current
        ) {
          submitLockRef.current = true;
          onConfirm(nombreOccupantsNum);
        }
      }}
    >
      <DialogHeader>
        <DialogTitle ref={headingRef} tabIndex={-1}>
          Check-in — étape {step} sur 3
        </DialogTitle>
      </DialogHeader>

      <nav aria-label="Étapes du check-in" className="grid grid-cols-3 gap-2">
        {['Client et alertes', 'Réservation et chambre', 'Confirmation'].map(
          (label, index) => {
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
          },
        )}
      </nav>

      <section className={step === 1 ? 'flex flex-col gap-3' : 'hidden'}>
        <SummaryGrid
          items={[
            ['Client', `${reservation.guest.prenom} ${reservation.guest.nom}`],
            ['Téléphone', reservation.guest.telephone ?? 'Non renseigné'],
            ['Email', reservation.guest.email ?? 'Non renseigné'],
            ['Nationalité', reservation.guest.nationalite ?? 'Non renseignée'],
            [
              "Pièce d'identité",
              reservation.guest.pieceIdentite ? 'Présente' : 'Absente',
            ],
            ['Catégorie', reservation.guest.categorie ?? 'Standard'],
          ]}
        />
        {isBlacklisted && (
          <AlertMessage variant="danger">
            Client actuellement en liste noire. Une validation ou une levée de
            blacklist est nécessaire avant le check-in.
          </AlertMessage>
        )}
        {!reservation.guest.pieceIdentite && (
          <AlertMessage>Pièce d’identité absente.</AlertMessage>
        )}
        {!reservation.guest.nationalite && (
          <AlertMessage>Nationalité non renseignée.</AlertMessage>
        )}
        {reservation.guest.preferences && (
          <AlertMessage variant="info">
            Préférences : {reservation.guest.preferences}
          </AlertMessage>
        )}
        <AlertMessage variant="info">
          La fiche Police devra être complétée après la création du séjour.
        </AlertMessage>
      </section>

      <section className={step === 2 ? 'flex flex-col gap-3' : 'hidden'}>
        <SummaryGrid
          items={[
            ['Canal', reservation.canal],
            ['Arrivée', reservation.dateArrivee.slice(0, 10)],
            ['Départ', reservation.dateDepart.slice(0, 10)],
            ['Nuitées', String(nights)],
            [
              'Chambre',
              `${reservation.room.numero} — ${reservation.room.roomType.nom}`,
            ],
            ['Statut chambre', roomStatus ?? 'Non disponible'],
            [
              'Formule',
              FORMULE_LABEL[reservation.formule ?? 'BED_AND_BREAKFAST'],
            ],
            ['Prix final', `${reservation.prixTotalFinal} MAD`],
            ['Ajustement manuel', reservation.ajustementManuel ? 'Oui' : 'Non'],
          ]}
        />
        {reservation.ajustementManuel && reservation.motifAjustement && (
          <AlertMessage variant="info">
            Motif de l’ajustement : {reservation.motifAjustement}
          </AlertMessage>
        )}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="nombreOccupants">Nombre d'occupants</Label>
          <Input
            id="nombreOccupants"
            type="number"
            min={1}
            max={capacite}
            value={nombreOccupants}
            onChange={(event) => setNombreOccupants(event.target.value)}
            required
          />
          {nombreOccupants !== '' && !occupantsValid && (
            <p className="text-destructive text-xs">
              Doit être un entier entre 1 et {capacite} (capacité de la
              chambre).
            </p>
          )}
        </div>
      </section>

      <section className={step === 3 ? 'flex flex-col gap-4' : 'hidden'}>
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold">Disponibilité de la chambre</h3>
          {availabilityLoading ? (
            <p className="text-muted-foreground text-sm">Vérification…</p>
          ) : availabilityError ? (
            <ErrorState
              title="Disponibilité non vérifiée"
              description={availabilityError}
              onRetry={() => setAvailabilityRetry((value) => value + 1)}
            />
          ) : availability?.disponible ? (
            <p className="text-success flex items-center gap-2 text-sm">
              <CheckCircle2 className="size-4" /> Vérification serveur positive
            </p>
          ) : (
            <AlertMessage variant="danger">
              Chambre indisponible
              {availability?.motifIndisponibilite
                ? ` : ${availability.motifIndisponibilite}`
                : availability?.datesConflit.length
                  ? ` : conflit sur ${availability.datesConflit.join(', ')}`
                  : '.'}
            </AlertMessage>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold">Acomptes</h3>
          {!canReadPayments ? (
            <p className="text-muted-foreground text-sm">
              Consultation non autorisée.
            </p>
          ) : depositsLoading ? (
            <p className="text-muted-foreground text-sm">Chargement…</p>
          ) : depositsError ? (
            <ErrorState
              title="Impossible de charger les acomptes"
              description={depositsError}
              onRetry={() => setDepositsRetry((value) => value + 1)}
            />
          ) : deposits.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Aucun acompte enregistré.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {deposits.map((deposit) => (
                <li
                  key={deposit.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-2 text-sm"
                >
                  <span>
                    {deposit.montant} MAD — {deposit.moyen}
                  </span>
                  <Badge variant="outline">
                    {DEPOSIT_STATUS_LABEL[deposit.statut]}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </div>
        {error && <AlertMessage variant="danger">{error}</AlertMessage>}
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
        <Button type="submit" disabled={step === 3 ? !canConfirm : false}>
          {step < 3
            ? 'Continuer'
            : submitting
              ? 'Check-in…'
              : 'Confirmer le check-in'}
        </Button>
      </DialogFooter>
    </form>
  );
}

function SummaryGrid({ items }: { items: Array<[string, string]> }) {
  return (
    <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {items.map(([label, value]) => (
        <div key={label} className="rounded-md border p-3">
          <dt className="text-muted-foreground text-xs">{label}</dt>
          <dd className="mt-1 text-sm font-medium break-words">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function AlertMessage({
  children,
  variant = 'warning',
}: {
  children: React.ReactNode;
  variant?: 'warning' | 'danger' | 'info';
}) {
  const className =
    variant === 'danger'
      ? 'border-destructive/30 bg-destructive/10 text-destructive'
      : variant === 'info'
        ? 'border-info/30 bg-info/10 text-info'
        : 'border-warning/30 bg-warning/10 text-warning';
  return (
    <p
      className={`flex items-start gap-2 rounded-md border p-3 text-sm ${className}`}
    >
      <AlertTriangle className="mt-0.5 size-4 shrink-0" />
      <span>{children}</span>
    </p>
  );
}
