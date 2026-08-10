import { useState } from 'react';
import { CalendarDays, DoorOpen, Mail, Phone, Users } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
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
import { SectionHeader } from '@/components/ui/section-header';
import type { Reservation } from '../types';
import { CANAL_LABEL } from '../reservation-presentation';
import { SelfCheckinPanel } from './SelfCheckinPanel';

const STATUS: Record<
  Reservation['statut'],
  { label: string; variant: 'success' | 'destructive' | 'warning' | 'info' }
> = {
  CONFIRMEE: { label: 'Confirmée', variant: 'success' },
  ANNULEE: { label: 'Annulée', variant: 'destructive' },
  NO_SHOW: { label: 'No-show', variant: 'warning' },
  TRANSFORMEE_EN_SEJOUR: { label: 'Transformée en séjour', variant: 'info' },
};

interface Props {
  reservation: Reservation | null;
  onClose: () => void;
  onSave: (input: {
    prixTotalFinal?: number;
    motifAjustement?: string;
  }) => void;
  saving: boolean;
  error: string | null;
  canWrite: boolean;
}

export function ReservationDetailsDialog(props: Props) {
  return (
    <Dialog
      open={props.reservation !== null}
      onOpenChange={(next) => !next && props.onClose()}
    >
      <DialogContent className="max-h-[calc(100dvh-1rem)] overflow-y-auto sm:max-w-2xl">
        {props.reservation && (
          <ReservationDetailsForm
            key={props.reservation.id}
            {...props}
            reservation={props.reservation}
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
  canWrite,
}: Props & { reservation: Reservation }) {
  const [prixTotalFinal, setPrixTotalFinal] = useState(
    reservation.prixTotalFinal,
  );
  const [motifAjustement, setMotifAjustement] = useState(
    reservation.motifAjustement ?? '',
  );
  const priceChanged =
    Number(prixTotalFinal) !== Number(reservation.prixTotalFinal);
  const status = STATUS[reservation.statut];

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
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
      <DialogHeader>
        <div className="flex flex-wrap items-center gap-2 pr-8">
          <DialogTitle>
            {reservation.guest.nom} {reservation.guest.prenom}
          </DialogTitle>
          <Badge variant={status.variant}>{status.label}</Badge>
          <Badge variant="outline">{CANAL_LABEL[reservation.canal]}</Badge>
        </div>
        <p className="text-text-secondary text-sm">
          Réservation #{reservation.id}
        </p>
      </DialogHeader>

      <div className="grid gap-3 sm:grid-cols-2">
        <Info
          icon={<DoorOpen />}
          label="Chambre"
          value={`${reservation.room.numero} · ${reservation.room.roomType.nom}`}
        />
        <Info
          icon={<CalendarDays />}
          label="Dates"
          value={`${reservation.dateArrivee.slice(0, 10)} → ${reservation.dateDepart.slice(0, 10)}`}
        />
        <Info
          icon={<Users />}
          label="Occupants"
          value={
            reservation.nombreOccupants === null
              ? 'Non renseigné'
              : String(reservation.nombreOccupants)
          }
        />
        <Info
          icon={<Phone />}
          label="Téléphone"
          value={reservation.guest.telephone ?? 'Non renseigné'}
        />
        {reservation.guest.email && (
          <Info icon={<Mail />} label="Email" value={reservation.guest.email} />
        )}
      </div>

      {reservation.statut === 'CONFIRMEE' && (
        <SelfCheckinPanel
          reservationId={reservation.id}
          guestEmail={reservation.guest.email}
          canWrite={canWrite}
        />
      )}

      <Card>
        <CardContent className="gap-4">
          <SectionHeader
            title="Tarification"
            description="Montants calculés et appliqués par le moteur tarifaire."
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="bg-surface-2 rounded-md p-3">
              <p className="text-text-secondary text-xs font-semibold">
                Prix calculé
              </p>
              <MoneyDisplay
                className="mt-1 block text-base font-bold"
                value={reservation.prixTotalCalcule}
              />
            </div>
            <div className="bg-primary-soft rounded-md p-3">
              <p className="text-primary text-xs font-semibold">
                Prix final appliqué
              </p>
              <MoneyDisplay
                className="mt-1 block text-base font-bold"
                value={prixTotalFinal}
              />
            </div>
          </div>
          {canWrite && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="prixTotalFinal">Modifier le prix final</Label>
                <Input
                  id="prixTotalFinal"
                  type="number"
                  min={0}
                  step="0.01"
                  value={prixTotalFinal}
                  onChange={(event) => setPrixTotalFinal(event.target.value)}
                />
              </div>
              {(reservation.ajustementManuel || priceChanged) && (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="motifAjustement">Motif de l’ajustement</Label>
                  <Input
                    id="motifAjustement"
                    value={motifAjustement}
                    onChange={(event) => setMotifAjustement(event.target.value)}
                    placeholder="Ex. geste commercial validé"
                  />
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {reservation.sourceBrute && (
        <Card>
          <CardContent>
            <SectionHeader title="Informations complémentaires" />
            <p className="text-text-secondary mt-2 text-sm">
              {reservation.sourceBrute}
            </p>
          </CardContent>
        </Card>
      )}
      {error && (
        <Alert
          tone="destructive"
          title="Mise à jour impossible"
          description={error}
        />
      )}

      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
          disabled={saving}
        >
          Fermer
        </Button>
        {canWrite && (
          <Button type="submit" disabled={saving || !priceChanged}>
            {saving ? 'Enregistrement…' : 'Enregistrer le prix'}
          </Button>
        )}
      </DialogFooter>
    </form>
  );
}

function Info({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="bg-surface-2 flex min-h-16 items-center gap-3 rounded-md p-3">
      <span className="text-primary [&>svg]:size-5">{icon}</span>
      <div className="min-w-0">
        <p className="text-text-secondary text-xs font-semibold">{label}</p>
        <p className="truncate text-sm font-semibold">{value}</p>
      </div>
    </div>
  );
}
