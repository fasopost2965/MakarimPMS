import { useEffect, useRef, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ApiError } from '@/lib/api-client';
import type {
  PaymentRequiredErrorDetails,
  RoomUnavailableErrorDetails,
  Stay,
} from '../types';

interface Props {
  stay: Stay | null;
  onClose: () => void;
  onConfirm: (nouvelleDateCheckoutPrevue: string, motif: string) => void;
  submitting: boolean;
  error: unknown;
}

function isRoomUnavailable(
  details: unknown,
): details is RoomUnavailableErrorDetails {
  return (
    !!details &&
    typeof details === 'object' &&
    (details as { code?: unknown }).code === 'ROOM_UNAVAILABLE'
  );
}

function isPaymentRequired(
  details: unknown,
): details is PaymentRequiredErrorDetails {
  return (
    !!details &&
    typeof details === 'object' &&
    (details as { code?: unknown }).code === 'PAYMENT_REQUIRED'
  );
}

type ExtendStayErrorTranslation =
  | { kind: 'paymentRequired'; details: PaymentRequiredErrorDetails }
  | { kind: 'roomUnavailable'; details: RoomUnavailableErrorDetails }
  | { kind: 'invalidDate' }
  | { kind: 'stayClosed' }
  | { kind: 'unknown' };

// MX-002A — jamais `error.message` affiché tel quel : chaque cas connu du
// contrat de POST /stays/:id/extend (stay.service.ts) a une traduction
// explicite. Le cas "séjour clôturé" (ConflictException simple, sans champ
// `code`) est le SEUL conflit non structuré que cet endpoint peut lever —
// vérifié dans stay.service.ts avant d'écrire cette fonction — donc
// `status === 409 && !code` l'identifie sans ambiguïté, ce n'est pas un
// filtrage par contenu de message.
// Non exportée volontairement (react-refresh/only-export-components) : un
// fichier de composant ne doit exporter que des composants pour que le Fast
// Refresh reste fiable. Le comportement de cette fonction est couvert
// indirectement, au niveau DOM, par les tests `ExtendStayDialog — traduction
// des erreurs` ci-dessous (ExtendStayDialog.test.tsx) plutôt que par un
// import direct.
function translateExtendStayError(error: unknown): ExtendStayErrorTranslation {
  if (!(error instanceof ApiError)) return { kind: 'unknown' };
  if (isPaymentRequired(error.details)) {
    return { kind: 'paymentRequired', details: error.details };
  }
  if (isRoomUnavailable(error.details)) {
    return { kind: 'roomUnavailable', details: error.details };
  }
  if (error.status === 400) return { kind: 'invalidDate' };
  if (error.status === 409) return { kind: 'stayClosed' };
  return { kind: 'unknown' };
}

function ExtendStayErrorMessage({ error }: { error: unknown }) {
  if (!error) return null;
  const translation = translateExtendStayError(error);

  switch (translation.kind) {
    case 'paymentRequired': {
      const { amountRequired, availableCredit } = translation.details;
      const hasCredit = Number(availableCredit) > 0;
      return (
        <div className="border-destructive/30 bg-destructive/10 text-destructive flex flex-col gap-1 rounded-md border p-3 text-sm">
          <p>
            Un paiement complémentaire de {amountRequired} DH est nécessaire
            avant de prolonger le séjour.
          </p>
          {hasCredit && (
            <p className="text-xs opacity-90">
              Crédit actuellement disponible : {availableCredit} DH
            </p>
          )}
        </div>
      );
    }
    case 'roomUnavailable': {
      const { alternatives } = translation.details;
      return (
        <div className="border-destructive/30 bg-destructive/10 text-destructive flex flex-col gap-2 rounded-md border p-3 text-sm">
          <p>
            La chambre actuelle n'est pas disponible pour toute la période
            demandée.
          </p>
          {alternatives.length > 0 && (
            <ul className="flex flex-col gap-1">
              {alternatives.map((room) => (
                <li key={room.id} className="text-xs">
                  Chambre {room.numero} — {room.roomType.nom}
                  {room.roomType.capacite
                    ? ` (${room.roomType.capacite} pers.)`
                    : ''}
                </li>
              ))}
            </ul>
          )}
          <p className="text-xs font-medium opacity-90">
            Le changement de chambre doit être effectué séparément.
          </p>
        </div>
      );
    }
    case 'invalidDate':
      return (
        <p className="text-destructive text-sm">
          Choisissez une date postérieure à la date de départ actuelle.
        </p>
      );
    case 'stayClosed':
      return (
        <p className="text-destructive text-sm">
          Ce séjour est clôturé et ne peut plus être prolongé.
        </p>
      );
    case 'unknown':
    default:
      return (
        <p className="text-destructive text-sm">
          La prolongation n'a pas pu être enregistrée. Réessayez ou contactez un
          responsable si le problème persiste.
        </p>
      );
  }
}

export function ExtendStayDialog({
  stay,
  onClose,
  onConfirm,
  submitting,
  error,
}: Props) {
  const [nouvelleDate, setNouvelleDate] = useState('');
  const [motif, setMotif] = useState('');
  const dateInputRef = useRef<HTMLInputElement>(null);
  const submitLockRef = useRef(false);

  // Réinitialisation du formulaire à chaque (ré)ouverture — pattern React
  // recommandé pour « ajuster un état à partir d'une prop qui change »
  // (calcul direct pendant le rendu plutôt qu'un useEffect qui provoquerait
  // un rendu en cascade évitable, voir react-hooks/set-state-in-effect).
  // `stay` redevient `null` à la fermeture (CheckinPage), donc une
  // réouverture ultérieure sur le MÊME séjour redéclenche bien la
  // comparaison ci-dessous. Seuls des `useState` sont touchés ici — un ref
  // ne peut pas être muté pendant le rendu (react-hooks/refs), d'où le
  // useEffect séparé juste en dessous pour submitLockRef.
  const [lastStayId, setLastStayId] = useState<number | null>(null);
  if ((stay?.id ?? null) !== lastStayId) {
    setLastStayId(stay?.id ?? null);
    setNouvelleDate('');
    setMotif('');
  }

  const dateActuelle = stay?.dateCheckoutPrevue.slice(0, 10) ?? '';
  const minDate = dateActuelle
    ? new Date(new Date(dateActuelle).getTime() + 24 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 10)
    : undefined;

  const isDateValid =
    nouvelleDate.length > 0 && !!dateActuelle && nouvelleDate > dateActuelle;
  const isMotifValid = motif.trim().length >= 10;
  const canConfirm = isDateValid && isMotifValid && !submitting;

  useEffect(() => {
    submitLockRef.current = false;
  }, [stay?.id]);

  useEffect(() => {
    if (error) submitLockRef.current = false;
  }, [error]);

  function handleOpenChange(next: boolean) {
    // La fermeture Échap passe par ici (Dialog/Radix gère déjà le clavier) —
    // aucun code custom requis, juste ne pas fermer pendant une soumission
    // en vol.
    if (!next && !submitting) onClose();
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!canConfirm || submitLockRef.current) return;
    submitLockRef.current = true;
    onConfirm(nouvelleDate, motif.trim());
  }

  return (
    <Dialog open={stay !== null} onOpenChange={handleOpenChange}>
      {/* Focus initial accessible : délégué au comportement natif de la
          librairie (base-ui Dialog.Popup `initialFocus`) plutôt qu'un appel
          manuel en useEffect qui serait de toute façon écrasé par son focus
          par défaut ("premier élément tabbable") — voir DialogPopup.d.mts. */}
      <DialogContent initialFocus={dateInputRef}>
        {stay && (
          <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>Prolonger le séjour</DialogTitle>
              <DialogDescription>
                Chambre {stay.room.numero} — {stay.guest.nom}{' '}
                {stay.guest.prenom}
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-2">
              <Label>Date de départ actuelle</Label>
              <p className="text-muted-foreground text-sm">
                {dateActuelle || 'Non renseignée'}
              </p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="extend-date">Nouvelle date de départ</Label>
              <Input
                id="extend-date"
                ref={dateInputRef}
                type="date"
                min={minDate}
                value={nouvelleDate}
                onChange={(e) => setNouvelleDate(e.target.value)}
                disabled={submitting}
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="extend-motif">
                Motif (minimum 10 caractères)
              </Label>
              <Input
                id="extend-motif"
                value={motif}
                onChange={(e) => setMotif(e.target.value)}
                disabled={submitting}
                required
              />
            </div>

            <ExtendStayErrorMessage error={error} />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={submitting}
              >
                Annuler
              </Button>
              <Button type="submit" disabled={!canConfirm}>
                {submitting ? 'Prolongation…' : 'Confirmer'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
