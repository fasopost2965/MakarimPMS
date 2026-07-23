import { useState } from 'react';
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
import { Badge } from '@/components/ui/badge';
import { SelfCheckinPanel } from './SelfCheckinPanel';
import type { Reservation } from '../types';

interface Props {
  reservation: Reservation | null;
  onClose: () => void;
  onSave: (input: {
    prixTotalFinal?: number;
    motifAjustement?: string;
  }) => void;
  saving: boolean;
  error: string | null;
}

export function ReservationDetailsDialog({
  reservation,
  onClose,
  onSave,
  saving,
  error,
}: Props) {
  return (
    <Dialog
      open={reservation !== null}
      onOpenChange={(next) => !next && onClose()}
    >
      <DialogContent>
        {reservation && (
          <ReservationDetailsForm
            key={reservation.id}
            reservation={reservation}
            onClose={onClose}
            onSave={onSave}
            saving={saving}
            error={error}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function ReservationDetailsForm({
  reservation,
  onClose,
  onSave,
  saving,
  error,
}: Props & { reservation: Reservation }) {
  const [prixTotalFinal, setPrixTotalFinal] = useState(
    reservation.prixTotalFinal,
  );
  const [motifAjustement, setMotifAjustement] = useState(
    reservation.motifAjustement ?? '',
  );

  const priceChanged =
    Number(prixTotalFinal) !== Number(reservation.prixTotalFinal);

  return (
    <>
      <DialogHeader>
        <DialogTitle>
          Réservation — {reservation.guest.nom} {reservation.guest.prenom}
        </DialogTitle>
      </DialogHeader>

      <p className="text-muted-foreground text-sm">
        Chambre {reservation.room.numero} ({reservation.room.roomType.nom}) — du{' '}
        {reservation.dateArrivee.slice(0, 10)} au{' '}
        {reservation.dateDepart.slice(0, 10)}
      </p>

      {reservation.statut === 'CONFIRMEE' && (
        <SelfCheckinPanel
          reservationId={reservation.id}
          guestEmail={reservation.guest.email}
        />
      )}

      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          onSave(
            priceChanged
              ? {
                  prixTotalFinal: Number(prixTotalFinal),
                  motifAjustement: motifAjustement || undefined,
                }
              : {},
          );
        }}
      >
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="prixTotalCalcule">
            Prix calculé (tarification saisonnière)
          </Label>
          <Input
            id="prixTotalCalcule"
            value={`${reservation.prixTotalCalcule} DH`}
            readOnly
            disabled
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <Label htmlFor="prixTotalFinal">Prix final appliqué</Label>
            {reservation.ajustementManuel && (
              <Badge variant="destructive">Ajustement manuel</Badge>
            )}
          </div>
          <Input
            id="prixTotalFinal"
            type="number"
            min={0}
            step="0.01"
            value={prixTotalFinal}
            onChange={(e) => setPrixTotalFinal(e.target.value)}
          />
        </div>

        {(reservation.ajustementManuel || priceChanged) && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="motifAjustement">
              Motif de l'ajustement (optionnel)
            </Label>
            <Input
              id="motifAjustement"
              value={motifAjustement}
              onChange={(e) => setMotifAjustement(e.target.value)}
              placeholder="ex. geste commercial, erreur de saisie…"
            />
          </div>
        )}

        {error && <p className="text-destructive text-sm">{error}</p>}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={saving}
          >
            Fermer
          </Button>
          <Button type="submit" disabled={saving || !priceChanged}>
            {saving ? 'Enregistrement…' : 'Enregistrer le prix'}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}
