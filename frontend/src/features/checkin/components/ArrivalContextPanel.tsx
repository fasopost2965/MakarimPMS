import { AlertTriangle, LogIn } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { MoneyDisplay } from '@/components/ui/money-display';
import {
  CANAL_LABEL,
  FORMULE_LABEL,
} from '../../reservations/reservation-presentation';
import type { Reservation } from '../../reservations/types';

interface Props {
  reservation: Reservation | null;
  permissions: string[] | null;
  onClose: () => void;
  onViewRoom: (reservation: Reservation) => void;
  onCheckinClick: (reservation: Reservation) => void;
  onNoShowClick: (reservation: Reservation) => void;
}

// DESIGN-009 — panneau de consultation avant action, repris du prototype
// PrototypeFrontDeskA (ArrivalContextBody) : les actions réelles
// (Check-in/No-show) restent déléguées aux dialogues déjà existants
// (ReservationCheckinDialog, NoShowDialog — voir CheckinPage), ce panneau
// ne fait jamais lui-même d'appel API. RBAC strictement sur la permission
// effective (jamais de nom de rôle) — checkin:write pour le check-in,
// reservations:delete pour le no-show (même permission que
// ReservationContextPanel, DESIGN-007 : `reservations:delete` couvre à la
// fois l'annulation et le no-show, backend/prisma/seed.ts).
export function ArrivalContextPanel({
  reservation,
  permissions,
  onClose,
  onViewRoom,
  onCheckinClick,
  onNoShowClick,
}: Props) {
  const canCheckin = permissions?.includes('checkin:write') ?? false;
  const canNoShow = permissions?.includes('reservations:delete') ?? false;

  return (
    <Dialog
      open={reservation !== null}
      onOpenChange={(next) => !next && onClose()}
    >
      <DialogContent className="sm:max-w-lg">
        {reservation && (
          <>
            <DialogHeader>
              <DialogTitle>
                {reservation.guest.nom} {reservation.guest.prenom}
              </DialogTitle>
            </DialogHeader>
            <div className="bg-muted/30 flex flex-col gap-2 rounded-lg border p-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="success">Confirmée</Badge>
                <Badge variant="outline">
                  {CANAL_LABEL[reservation.canal]}
                </Badge>
              </div>
              <p className="text-muted-foreground text-sm">
                Chambre {reservation.room.numero} (
                {reservation.room.roomType.nom}) —{' '}
                {reservation.nombreOccupants ?? '—'} occupant
                {(reservation.nombreOccupants ?? 0) > 1 ? 's' : ''} —{' '}
                {FORMULE_LABEL[reservation.formule]}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-surface-2 rounded-md p-3">
                <p className="text-muted-foreground text-xs font-semibold">
                  Prix calculé
                </p>
                <MoneyDisplay
                  className="mt-1 block text-base font-bold"
                  value={reservation.prixTotalCalcule}
                />
              </div>
              <div className="bg-primary-soft rounded-md p-3">
                <p className="text-primary text-xs font-semibold">Prix final</p>
                <MoneyDisplay
                  className="mt-1 block text-base font-bold"
                  value={reservation.prixTotalFinal}
                />
              </div>
            </div>
            <DialogFooter className="flex-col gap-2 sm:flex-row sm:flex-wrap">
              <Button
                type="button"
                variant="outline"
                onClick={() => onViewRoom(reservation)}
              >
                Voir la chambre
              </Button>
              {canNoShow && (
                <Button
                  type="button"
                  variant="outline"
                  className="text-warning"
                  onClick={() => onNoShowClick(reservation)}
                >
                  <AlertTriangle className="size-4" />
                  Marquer no-show
                </Button>
              )}
              {canCheckin && (
                <Button
                  type="button"
                  onClick={() => onCheckinClick(reservation)}
                >
                  <LogIn className="size-4" />
                  Check-in
                </Button>
              )}
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
