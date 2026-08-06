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
import type { Room } from '../../reservations/types';
import type { Stay } from '../types';

interface Props {
  stay: Stay | null;
  rooms: Room[];
  onClose: () => void;
  onConfirm: (newRoomId: number, motif: string) => void;
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
      <div
        role="radiogroup"
        aria-label="Chambre de destination"
        className="grid max-h-64 gap-2 overflow-y-auto sm:grid-cols-2"
      >
        {candidateRooms.map((room) => {
          const selected = room.id === selectedRoomId;
          return (
            <button
              key={room.id}
              type="button"
              role="radio"
              aria-checked={selected}
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
// 4. Résumé (étape de confirmation, avant tout appel API)
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
  const submitLockRef = useRef(false);

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

  function handleOpenChange(next: boolean) {
    if (!next && !submitting) onClose();
  }

  function handleContinue() {
    if (!isSelectionValid) return;
    setStep('confirmation');
  }

  function handleConfirm() {
    if (!selectedRoom || submitLockRef.current) return;
    submitLockRef.current = true;
    onConfirm(selectedRoom.id, motif.trim());
  }

  return (
    <Dialog open={stay !== null} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        {stay && (
          <div className="flex flex-col gap-4">
            <DialogHeader>
              <DialogTitle>Changer de chambre</DialogTitle>
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
                      disabled={submitting}
                    />
                    <MotifSection
                      motif={motif}
                      onChange={setMotif}
                      disabled={submitting}
                    />
                  </>
                )}
              </>
            ) : (
              selectedRoom && (
                <SummarySection
                  stay={stay}
                  newRoom={selectedRoom}
                  motif={motif}
                />
              )
            )}

            {step === 'confirmation' && !!error && (
              <p className="text-destructive text-sm">
                {getErrorMessage(error)}
              </p>
            )}

            {/* 5. Actions */}
            <DialogFooter>
              {step === 'selection' ? (
                <>
                  <Button type="button" variant="outline" onClick={onClose}>
                    Annuler
                  </Button>
                  {candidateRooms.length > 0 && (
                    <Button
                      type="button"
                      onClick={handleContinue}
                      disabled={!isSelectionValid}
                    >
                      Continuer
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
