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
import { EmptyState } from '@/components/ui/empty-state';
import { ApiError } from '@/lib/api-client';
import { previewChangeRoom } from '../api';
import type { Room } from '../../reservations/types';
import type { ChangeRoomPreview, Stay } from '../types';

interface Props {
  stay: Stay | null;
  rooms: Room[];
  onClose: () => void;
  // DESIGN-009B — pricingFingerprint ajouté (obtenu via previewChangeRoom
  // ci-dessous, jamais inventé par ce composant).
  onConfirm: (
    newRoomId: number,
    motif: string,
    pricingFingerprint: string,
  ) => void;
  submitting: boolean;
  error: unknown;
}

// MX-002C — GL-002 ne lève aucune erreur structurée côté backend (contrat
// vérifié dans stay.service.ts : les 4 conflits sont des ConflictException
// texte simples, sans champ `code`) — contrairement à extendStay, il n'y a
// donc rien à extraire/durcir ici. `error.message` (ApiError ou Error
// standard) est déjà rédigé par le backend en français métier, sans jargon
// technique : affichable tel quel (EXIGENCES_UX.md).
function getErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Le changement de chambre n'a pas pu être enregistré. Réessayez ou contactez un responsable si le problème persiste.";
}

// DESIGN-009B — durcissement du corps d'erreur structuré (`ApiError.details`
// vient du réseau, jamais fait confiance à un simple cast), même convention
// que ExtendStayDialog::toSafeAlternative.
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function toSafeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === 'string');
}

function toSafeRoomSummary(
  value: unknown,
): ChangeRoomPreview['oldRoom'] | null {
  if (!isPlainObject(value)) return null;
  const id = typeof value.id === 'number' ? value.id : null;
  const numero = typeof value.numero === 'string' ? value.numero : null;
  const roomTypeNom =
    typeof value.roomTypeNom === 'string' ? value.roomTypeNom : null;
  if (id === null || numero === null || roomTypeNom === null) return null;
  return { id, numero, roomTypeNom };
}

// Corps de POST /stays/:id/change-room/preview (succès) OU du champ
// `preview` d'une erreur CHANGE_ROOM_PREVIEW_STALE (même forme) — une seule
// fonction de validation pour les deux origines.
function toSafePreview(value: unknown): ChangeRoomPreview | null {
  if (!isPlainObject(value)) return null;
  const oldRoom = toSafeRoomSummary(value.oldRoom);
  const newRoom = toSafeRoomSummary(value.newRoom);
  const ancienMontantRestant =
    typeof value.ancienMontantRestant === 'string'
      ? value.ancienMontantRestant
      : null;
  const nouveauMontantRestant =
    typeof value.nouveauMontantRestant === 'string'
      ? value.nouveauMontantRestant
      : null;
  const difference =
    typeof value.difference === 'string' ? value.difference : null;
  const pricingFingerprint =
    typeof value.pricingFingerprint === 'string'
      ? value.pricingFingerprint
      : null;
  if (
    !oldRoom ||
    !newRoom ||
    ancienMontantRestant === null ||
    nouveauMontantRestant === null ||
    difference === null ||
    pricingFingerprint === null
  ) {
    return null;
  }
  return {
    oldRoom,
    newRoom,
    nuitsImpactees: toSafeStringArray(value.nuitsImpactees),
    ancienMontantRestant,
    nouveauMontantRestant,
    difference,
    pricingFingerprint,
    warnings: toSafeStringArray(value.warnings),
  };
}

type ChangeRoomErrorTranslation =
  | { kind: 'stale'; preview: ChangeRoomPreview; message: string }
  | { kind: 'capacityExceeded'; message: string }
  | { kind: 'generic'; message: string };

// DESIGN-009B — traduit une erreur réseau (preview OU commit) en une forme
// affichable. `CHANGE_ROOM_PREVIEW_STALE` ne peut provenir que du commit
// (jamais du preview lui-même) mais reste géré au même endroit pour éviter
// deux fonctions quasi identiques.
function translateChangeRoomError(error: unknown): ChangeRoomErrorTranslation {
  const message = getErrorMessage(error);
  if (!(error instanceof ApiError)) return { kind: 'generic', message };
  const details = error.details;

  if (isPlainObject(details) && details.code === 'CHANGE_ROOM_PREVIEW_STALE') {
    const preview = toSafePreview(details.preview);
    if (preview) {
      return {
        kind: 'stale',
        preview,
        message:
          'Les conditions tarifaires ont changé depuis votre confirmation.',
      };
    }
  }

  if (
    isPlainObject(details) &&
    details.code === 'CHANGE_ROOM_CAPACITY_EXCEEDED'
  ) {
    return { kind: 'capacityExceeded', message };
  }

  return { kind: 'generic', message };
}

// Tri explicite requis (RD architecture MX-002C §2) — jamais l'ordre
// renvoyé par l'API. `localeCompare(..., {numeric:true})` plutôt qu'un tri
// alphabétique naïf : correct même pour des numéros de chambre de longueurs
// différentes (ex. "9" avant "10").
function sortRoomsByNumero(rooms: Room[]): Room[] {
  return [...rooms].sort((a, b) =>
    a.numero.localeCompare(b.numero, undefined, { numeric: true }),
  );
}

// ---------------------------------------------------------------------
// 1. Informations du séjour
// ---------------------------------------------------------------------
// Emplacement réservé pour un futur historique des changements de chambre
// (ex. "101 → 205 → 312") — non développé dans cette mission (MX-002C
// §6 : préparer l'organisation, pas l'historique lui-même). Le composant
// est isolé pour pouvoir y insérer ce bloc plus tard sans toucher au reste
// du dialogue.
function StayInfoSection({ stay }: { stay: Stay }) {
  return (
    <section className="flex flex-col gap-1">
      <h3 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
        Informations du séjour
      </h3>
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="rounded-md border p-3">
          <p className="text-muted-foreground text-xs">Client</p>
          <p className="text-sm font-medium">
            {stay.guest.prenom} {stay.guest.nom}
          </p>
        </div>
        <div className="rounded-md border p-3">
          <p className="text-muted-foreground text-xs">Chambre actuelle</p>
          <p className="text-sm font-medium">
            {stay.room.numero} — {stay.room.roomType.nom}
          </p>
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------
// 2. Choix de la chambre
// ---------------------------------------------------------------------
function RoomSelectionSection({
  candidateRooms,
  selectedRoomId,
  onSelect,
  disabled,
}: {
  candidateRooms: Room[];
  selectedRoomId: number | null;
  onSelect: (roomId: number) => void;
  disabled: boolean;
}) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
        Choix de la chambre
      </h3>
      {/* Revue qualité PR #79 : boutons standards + aria-pressed plutôt que
          role="radiogroup"/role="radio" — ce dernier engage un contrat
          clavier précis (navigation par flèches, un seul arrêt Tab pour tout
          le groupe) qui n'était pas implémenté, un vrai décalage entre le
          rôle annoncé et le comportement réel. Boutons indépendants : Tab
          standard entre chaque carte, comportement honnête. */}
      <div className="grid max-h-64 gap-2 overflow-y-auto sm:grid-cols-2">
        {candidateRooms.map((room) => {
          const selected = room.id === selectedRoomId;
          return (
            <button
              key={room.id}
              type="button"
              aria-pressed={selected}
              disabled={disabled}
              onClick={() => onSelect(room.id)}
              className={`flex flex-col gap-0.5 rounded-md border p-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                selected
                  ? 'border-primary bg-primary/5'
                  : 'hover:border-primary/50 border-border'
              }`}
            >
              <span className="text-base font-semibold">{room.numero}</span>
              <span className="text-muted-foreground text-sm">
                {room.roomType.nom}
              </span>
              {room.roomType.capacite && (
                <span className="text-muted-foreground text-xs">
                  {room.roomType.capacite} personne
                  {room.roomType.capacite > 1 ? 's' : ''}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------
// 3. Motif
// ---------------------------------------------------------------------
function MotifSection({
  motif,
  onChange,
  disabled,
}: {
  motif: string;
  onChange: (value: string) => void;
  disabled: boolean;
}) {
  return (
    <section className="grid gap-2">
      <Label htmlFor="change-room-motif">Motif (minimum 10 caractères)</Label>
      <Input
        id="change-room-motif"
        value={motif}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        required
      />
    </section>
  );
}

// ---------------------------------------------------------------------
// 4. Impact tarifaire (DESIGN-009B) — aperçu serveur affiché tel quel,
// jamais un montant recalculé côté client (aucune logique financière
// autoritative dans le frontend).
// ---------------------------------------------------------------------
function PricingImpactSection({ preview }: { preview: ChangeRoomPreview }) {
  const aucuneNuitRestante = preview.nuitsImpactees.length === 0;
  const aucunImpact = !aucuneNuitRestante && preview.difference === '0.00';

  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
        Impact tarifaire
      </h3>
      <div className="flex flex-col gap-3 rounded-md border p-3 text-sm">
        <div>
          <p className="text-muted-foreground text-xs">Nuits impactées</p>
          <p className="font-medium">
            {preview.nuitsImpactees.length} nuit
            {preview.nuitsImpactees.length > 1 ? 's' : ''}
          </p>
        </div>
        {aucuneNuitRestante ? (
          <p className="text-muted-foreground">
            Aucune nuit restante — aucun impact tarifaire.
          </p>
        ) : aucunImpact ? (
          <p className="text-muted-foreground">Aucun impact tarifaire.</p>
        ) : (
          <>
            <div className="grid gap-2 sm:grid-cols-2">
              <div>
                <p className="text-muted-foreground text-xs">
                  Ancien montant restant
                </p>
                <p className="font-medium">
                  {preview.ancienMontantRestant} MAD
                </p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">
                  Nouveau montant restant
                </p>
                <p className="font-medium">
                  {preview.nouveauMontantRestant} MAD
                </p>
              </div>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Différence</p>
              <p className="font-semibold">{preview.difference} MAD</p>
            </div>
          </>
        )}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------
// 5. Résumé (étape de confirmation, avant tout appel API)
// ---------------------------------------------------------------------
function SummarySection({
  stay,
  newRoom,
  motif,
}: {
  stay: Stay;
  newRoom: Room;
  motif: string;
}) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
        Résumé
      </h3>
      <div className="flex flex-col gap-3 rounded-md border p-3 text-sm">
        <div>
          <p className="text-muted-foreground text-xs">Client</p>
          <p className="font-medium">
            {stay.guest.prenom} {stay.guest.nom}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div>
            <p className="text-muted-foreground text-xs">Chambre actuelle</p>
            <p className="font-medium">{stay.room.numero}</p>
          </div>
          <span className="text-muted-foreground">→</span>
          <div>
            <p className="text-muted-foreground text-xs">Nouvelle chambre</p>
            <p className="font-medium">
              {newRoom.numero} — {newRoom.roomType.nom}
            </p>
          </div>
        </div>
        <div>
          <p className="text-muted-foreground text-xs">Motif</p>
          <p className="font-medium">{motif}</p>
        </div>
      </div>
    </section>
  );
}

export function ChangeRoomDialog({
  stay,
  rooms,
  onClose,
  onConfirm,
  submitting,
  error,
}: Props) {
  const [step, setStep] = useState<'selection' | 'confirmation'>('selection');
  const [newRoomId, setNewRoomId] = useState<number | null>(null);
  const [motif, setMotif] = useState('');
  const [preview, setPreview] = useState<ChangeRoomPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<unknown>(null);
  const submitLockRef = useRef(false);
  // DESIGN-009B — erreur de commit (`error` prop) déjà prise en compte par
  // un nouvel aperçu tarifaire (Modifier → Continuer) : sans ceci, un
  // aperçu fraîchement rechargé resterait écrasé par l'ancienne erreur
  // CHANGE_ROOM_PREVIEW_STALE tant que le parent ne l'a pas explicitement
  // effacée (il ne le fait qu'au prochain clic Confirmer). `useState` et
  // non `useRef` : lu pendant le rendu ci-dessous (react-hooks/refs
  // interdit de lire un ref pendant le rendu), écrit uniquement depuis un
  // gestionnaire d'évènement (handleContinue), jamais pendant le rendu.
  const [ignoredError, setIgnoredError] = useState<unknown>(null);
  // Revue qualité PR #79 : focus initial explicite manquant (régression vs
  // ExtendStayDialog). Cible le titre plutôt qu'un champ précis — même
  // convention que ReservationCheckinDialog (headingRef), pertinente ici
  // aussi car le dialogue est multi-étapes sans champ "premier" unique.
  const titleRef = useRef<HTMLHeadingElement>(null);

  // Réinitialisation à chaque (ré)ouverture — même pattern que
  // ExtendStayDialog (MX-002A) : calcul pendant le rendu plutôt qu'un
  // useEffect (react-hooks/set-state-in-effect). Jamais de présélection de
  // chambre (RD architecture MX-002C §5), même si une seule est candidate.
  // Seuls des `useState` sont touchés ici — un ref ne peut pas être muté
  // pendant le rendu (react-hooks/refs), d'où le useEffect séparé pour
  // submitLockRef.
  const [lastStayId, setLastStayId] = useState<number | null>(null);
  if ((stay?.id ?? null) !== lastStayId) {
    setLastStayId(stay?.id ?? null);
    setStep('selection');
    setNewRoomId(null);
    setMotif('');
    setPreview(null);
    setPreviewError(null);
    setIgnoredError(null);
  }

  useEffect(() => {
    submitLockRef.current = false;
  }, [stay?.id]);

  useEffect(() => {
    if (error) submitLockRef.current = false;
  }, [error]);

  const candidateRooms = stay
    ? sortRoomsByNumero(
        rooms.filter(
          (room) => room.statut === 'LIBRE_PROPRE' && room.id !== stay.roomId,
        ),
      )
    : [];
  const selectedRoom =
    candidateRooms.find((room) => room.id === newRoomId) ?? null;

  const isSelectionValid = selectedRoom !== null && motif.trim().length >= 10;

  // DESIGN-009B — seule la traduction CHANGE_ROOM_PREVIEW_STALE porte un
  // aperçu de remplacement (`.preview`) : une fois qu'un nouvel aperçu a été
  // rechargé (Modifier → Continuer, voir setIgnoredError ci-dessous), cette
  // traduction devient obsolète et ne doit plus écraser l'aperçu fraîchement
  // chargé — mais un message d'erreur générique/capacité (sans aperçu de
  // remplacement) reste affiché tel quel, même comportement qu'avant
  // DESIGN-009B (aucune régression du test "message backend tel quel").
  const rawErrorTranslation = error ? translateChangeRoomError(error) : null;
  const staleOverrideSuperseded = error === ignoredError;
  const errorTranslation =
    rawErrorTranslation?.kind === 'stale' && staleOverrideSuperseded
      ? null
      : rawErrorTranslation;
  const effectivePreview =
    errorTranslation?.kind === 'stale' ? errorTranslation.preview : preview;

  function handleOpenChange(next: boolean) {
    if (!next && !submitting) onClose();
  }

  async function handleContinue() {
    if (!isSelectionValid || !selectedRoom || !stay || previewLoading) return;
    // Toute erreur de commit affichée jusqu'ici concerne l'aperçu précédent
    // — un nouvel aperçu la rend obsolète.
    setIgnoredError(error);
    setPreviewError(null);
    setPreviewLoading(true);
    try {
      const result = await previewChangeRoom(stay.id, selectedRoom.id);
      setPreview(result);
      setStep('confirmation');
    } catch (err) {
      setPreviewError(err);
    } finally {
      setPreviewLoading(false);
    }
  }

  function handleConfirm() {
    if (!selectedRoom || !effectivePreview || submitLockRef.current) return;
    submitLockRef.current = true;
    onConfirm(
      selectedRoom.id,
      motif.trim(),
      effectivePreview.pricingFingerprint,
    );
  }

  const previewErrorTranslation = previewError
    ? translateChangeRoomError(previewError)
    : null;

  return (
    <Dialog open={stay !== null} onOpenChange={handleOpenChange}>
      <DialogContent
        initialFocus={titleRef}
        className="max-h-[90vh] overflow-y-auto sm:max-w-2xl"
      >
        {stay && (
          <div className="flex flex-col gap-4">
            <DialogHeader>
              <DialogTitle ref={titleRef} tabIndex={-1}>
                Changer de chambre
              </DialogTitle>
              <DialogDescription>
                {step === 'selection'
                  ? 'Choisissez la chambre de destination et indiquez le motif.'
                  : 'Vérifiez les informations avant de confirmer.'}
              </DialogDescription>
            </DialogHeader>

            <StayInfoSection stay={stay} />

            {step === 'selection' ? (
              <>
                {candidateRooms.length === 0 ? (
                  <EmptyState
                    title="Aucune chambre propre disponible."
                    description="Toutes les chambres sont actuellement indisponibles. Impossible d'effectuer un changement de chambre."
                    action={{ label: 'Fermer', onClick: onClose }}
                  />
                ) : (
                  <>
                    <RoomSelectionSection
                      candidateRooms={candidateRooms}
                      selectedRoomId={newRoomId}
                      onSelect={setNewRoomId}
                      disabled={previewLoading}
                    />
                    <MotifSection
                      motif={motif}
                      onChange={setMotif}
                      disabled={previewLoading}
                    />
                    {previewErrorTranslation && (
                      <p className="text-destructive text-sm">
                        {previewErrorTranslation.message}
                      </p>
                    )}
                  </>
                )}
              </>
            ) : (
              selectedRoom &&
              effectivePreview && (
                <>
                  <SummarySection
                    stay={stay}
                    newRoom={selectedRoom}
                    motif={motif}
                  />
                  <PricingImpactSection preview={effectivePreview} />
                </>
              )
            )}

            {step === 'confirmation' && errorTranslation && (
              <p className="text-destructive text-sm">
                {errorTranslation.message}
              </p>
            )}

            {/* 6. Actions */}
            <DialogFooter>
              {step === 'selection' ? (
                <>
                  <Button type="button" variant="outline" onClick={onClose}>
                    Annuler
                  </Button>
                  {candidateRooms.length > 0 && (
                    <Button
                      type="button"
                      onClick={() => void handleContinue()}
                      disabled={!isSelectionValid || previewLoading}
                    >
                      {previewLoading ? 'Vérification…' : 'Continuer'}
                    </Button>
                  )}
                </>
              ) : (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setStep('selection')}
                    disabled={submitting}
                  >
                    Modifier
                  </Button>
                  <Button
                    type="button"
                    onClick={handleConfirm}
                    disabled={submitting}
                  >
                    {submitting ? 'Changement…' : 'Confirmer'}
                  </Button>
                </>
              )}
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
