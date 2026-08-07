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
import type { Stay } from '../types';

interface Props {
  stay: Stay | null;
  onClose: () => void;
  onConfirm: (nouvelleDateCheckoutPrevue: string, motif: string) => void;
  submitting: boolean;
  error: unknown;
}

// PR #78 — durcissement : `ApiError.details` vient du réseau (`unknown`),
// jamais fait confiance à un simple cast. Chaque champ effectivement utilisé
// à l'affichage est validé individuellement ; une entrée invalide est
// ignorée plutôt que de faire planter le dialogue ou d'afficher
// `undefined`/`NaN`/`[object Object]`.
interface SafeRoomAlternative {
  id: number;
  numero: string;
  roomTypeNom: string;
  capacite?: number;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

// Aucun formateur monétaire partagé n'existe ailleurs dans le projet
// (vérifié : `lib/utils.ts` ne contient que `cn`) — formatage local
// français stable à deux décimales, comme demandé, plutôt que d'introduire
// un fichier hors périmètre de cette mission.
function formatMontant(value: number): string {
  return `${new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)} MAD`;
}

function toSafeAlternative(value: unknown): SafeRoomAlternative | null {
  if (!isPlainObject(value)) return null;
  const id = toFiniteNumber(value.id);
  const numero =
    typeof value.numero === 'string' && value.numero.length > 0
      ? value.numero
      : null;
  if (id === null || numero === null || !isPlainObject(value.roomType)) {
    return null;
  }
  const nom =
    typeof value.roomType.nom === 'string' && value.roomType.nom.length > 0
      ? value.roomType.nom
      : null;
  if (nom === null) return null;
  const capaciteRaw = toFiniteNumber(value.roomType.capacite);
  const capacite =
    capaciteRaw !== null && capaciteRaw > 0 ? capaciteRaw : undefined;
  return { id, numero, roomTypeNom: nom, capacite };
}

function toSafeAlternatives(value: unknown): SafeRoomAlternative[] {
  if (!Array.isArray(value)) return [];
  const safe: SafeRoomAlternative[] = [];
  for (const item of value) {
    const alternative = toSafeAlternative(item);
    if (alternative) safe.push(alternative);
  }
  return safe;
}

type ExtendStayErrorTranslation =
  | {
      kind: 'paymentRequired';
      amountRequired: number;
      availableCredit: number | null;
    }
  | { kind: 'roomUnavailable'; alternatives: SafeRoomAlternative[] }
  | { kind: 'invalidDate' }
  | { kind: 'stayClosed' }
  | { kind: 'unknown' };

// MX-002A — jamais `error.message` affiché tel quel : chaque cas connu du
// contrat de POST /stays/:id/extend (stay.service.ts) a une traduction
// explicite. Le cas "séjour clôturé" (ConflictException simple, sans champ
// `code`) est le SEUL conflit non structuré que cet endpoint peut lever —
// vérifié dans stay.service.ts avant d'écrire cette fonction — donc
// `status === 409 && !code` l'identifie sans ambiguïté, ce n'est pas un
// filtrage par contenu de message. `code` seul ne suffit jamais à valider un
// cas structuré (PR #78) : `amountRequired` invalide/absent sur
// PAYMENT_REQUIRED retombe sur `unknown` plutôt que d'afficher un montant
// cassé ; `alternatives` invalide/absente sur ROOM_UNAVAILABLE retombe sur
// une liste vide (le message d'indisponibilité reste affiché quand même).
// Non exportée volontairement (react-refresh/only-export-components) : un
// fichier de composant ne doit exporter que des composants pour que le Fast
// Refresh reste fiable. Le comportement de cette fonction est couvert
// indirectement, au niveau DOM, par les tests `ExtendStayDialog — traduction
// des erreurs` ci-dessous (ExtendStayDialog.test.tsx) plutôt que par un
// import direct.
function translateExtendStayError(error: unknown): ExtendStayErrorTranslation {
  if (!(error instanceof ApiError)) return { kind: 'unknown' };
  const details = error.details;

  if (isPlainObject(details) && details.code === 'PAYMENT_REQUIRED') {
    const amountRequired = toFiniteNumber(details.amountRequired);
    if (amountRequired === null) return { kind: 'unknown' };
    return {
      kind: 'paymentRequired',
      amountRequired,
      availableCredit: toFiniteNumber(details.availableCredit),
    };
  }

  if (isPlainObject(details) && details.code === 'ROOM_UNAVAILABLE') {
    return {
      kind: 'roomUnavailable',
      alternatives: toSafeAlternatives(details.alternatives),
    };
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
      const { amountRequired, availableCredit } = translation;
      const hasCredit = availableCredit !== null && availableCredit > 0;
      return (
        <div className="border-destructive/30 bg-destructive/10 text-destructive flex flex-col gap-1 rounded-md border p-3 text-sm">
          <p>
            Un paiement complémentaire de {formatMontant(amountRequired)} est
            nécessaire avant de prolonger le séjour.
          </p>
          {hasCredit && (
            <p className="text-xs opacity-90">
              Crédit actuellement disponible : {formatMontant(availableCredit)}
            </p>
          )}
        </div>
      );
    }
    case 'roomUnavailable': {
      const { alternatives } = translation;
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
                  Chambre {room.numero} — {room.roomTypeNom}
                  {room.capacite ? ` (${room.capacite} pers.)` : ''}
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
