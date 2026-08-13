import {
  AlertTriangle,
  CalendarPlus,
  LogIn,
  Phone,
  XCircle,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { MoneyDisplay } from '@/components/ui/money-display';
import { cn } from '@/lib/utils';
import { toDateOnly } from '../date-utils';
import { CANAL_LABEL, FORMULE_LABEL } from '../reservation-presentation';
import type { Reservation, StatutReservation } from '../types';
import { SelfCheckinPanel } from './SelfCheckinPanel';

const STATUS_BADGE: Record<
  StatutReservation,
  { label: string; variant: 'success' | 'destructive' | 'warning' | 'info' }
> = {
  CONFIRMEE: { label: 'Confirmée', variant: 'success' },
  ANNULEE: { label: 'Annulée', variant: 'destructive' },
  NO_SHOW: { label: 'No-show', variant: 'warning' },
  TRANSFORMEE_EN_SEJOUR: { label: 'Transformée en séjour', variant: 'info' },
};

function nights(dateArrivee: string, dateDepart: string) {
  return Math.round(
    (new Date(dateDepart).getTime() - new Date(dateArrivee).getTime()) /
      86_400_000,
  );
}

type PanelAction = {
  key: string;
  label: string;
  icon: typeof LogIn;
  tone?: 'destructive' | 'warning';
  onClick: () => void;
};

interface Props {
  reservation: Reservation | null;
  today: string;
  permissions: string[];
  onClose: () => void;
  onEdit: (reservation: Reservation) => void;
  onCancel: (reservation: Reservation) => void;
  onCheckin: (reservation: Reservation) => void;
  onNoShow: (reservation: Reservation) => void;
}

// DESIGN-007 — panneau contextuel validé sur Prototype C2 (mission
// "PRODUCTION BUILD FROM C2" §6/§7) : consultation d'abord, puis zone
// Actions dont le contenu dépend du statut réel, de la date, et du RBAC
// effectif (jamais de contournement backend — chaque bouton ouvre un
// dialogue déjà branché sur les endpoints réels, ou une capacité déjà
// exposée comme SelfCheckinPanel). Aucune action n'appelle directement une
// API ici : ce composant délègue tout aux callbacks fournis par
// ReservationsCalendarPage, qui possède les dialogues réels (édition,
// annulation, check-in, no-show).
export function ReservationContextPanel({
  reservation,
  today,
  permissions,
  onClose,
  onEdit,
  onCancel,
  onCheckin,
  onNoShow,
}: Props) {
  return (
    <Dialog
      open={reservation !== null}
      onOpenChange={(next) => !next && onClose()}
    >
      <DialogContent className="flex max-h-[90vh] w-full flex-col overflow-y-auto sm:max-w-lg">
        {reservation && (
          <PanelBody
            reservation={reservation}
            today={today}
            permissions={permissions}
            onEdit={onEdit}
            onCancel={onCancel}
            onCheckin={onCheckin}
            onNoShow={onNoShow}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function PanelBody({
  reservation,
  today,
  permissions,
  onEdit,
  onCancel,
  onCheckin,
  onNoShow,
}: Omit<Props, 'onClose' | 'reservation'> & { reservation: Reservation }) {
  const canWrite = permissions.includes('reservations:write');
  const canDelete = permissions.includes('reservations:delete');
  const canCheckin = permissions.includes('checkin:write');
  const arrived = toDateOnly(reservation.dateArrivee) <= today;
  const future = toDateOnly(reservation.dateArrivee) > today;
  const isConfirmee = reservation.statut === 'CONFIRMEE';

  const actions: PanelAction[] = [];
  if (isConfirmee && arrived && canCheckin) {
    actions.push({
      key: 'checkin',
      label: 'Effectuer le check-in',
      icon: LogIn,
      onClick: () => onCheckin(reservation),
    });
  }
  if (isConfirmee && canWrite) {
    actions.push({
      key: 'edit',
      label: 'Modifier la réservation',
      icon: CalendarPlus,
      onClick: () => onEdit(reservation),
    });
  }
  if (isConfirmee && canDelete) {
    actions.push({
      key: 'cancel',
      label: 'Annuler la réservation',
      icon: XCircle,
      tone: 'destructive',
      onClick: () => onCancel(reservation),
    });
  }
  if (isConfirmee && arrived && canDelete) {
    actions.push({
      key: 'no-show',
      label: 'Marquer no-show',
      icon: AlertTriangle,
      tone: 'warning',
      onClick: () => onNoShow(reservation),
    });
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>
          {reservation.guest.nom} {reservation.guest.prenom}
        </DialogTitle>
      </DialogHeader>

      <div className="bg-muted/30 flex flex-col gap-2 rounded-lg border p-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={STATUS_BADGE[reservation.statut].variant}>
            {STATUS_BADGE[reservation.statut].label}
          </Badge>
          <Badge variant="outline">{CANAL_LABEL[reservation.canal]}</Badge>
          {toDateOnly(reservation.dateArrivee) === today && isConfirmee && (
            <Badge variant="brand">Aujourd'hui</Badge>
          )}
        </div>
        <p className="text-muted-foreground text-sm">
          Chambre {reservation.room.numero} ({reservation.room.roomType.nom}) —{' '}
          {toDateOnly(reservation.dateArrivee)} →{' '}
          {toDateOnly(reservation.dateDepart)} (
          {nights(reservation.dateArrivee, reservation.dateDepart)} nuits)
        </p>
      </div>

      <div className="flex flex-col gap-3 pt-1">
        {reservation.guest.telephone && (
          <Info
            icon={<Phone className="size-4" />}
            label="Téléphone"
            value={reservation.guest.telephone}
          />
        )}
        <div className="grid grid-cols-2 gap-3">
          <Info
            label="Occupants"
            value={
              reservation.nombreOccupants === null
                ? 'Non renseigné'
                : String(reservation.nombreOccupants)
            }
          />
          <Info label="Formule" value={FORMULE_LABEL[reservation.formule]} />
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
        {reservation.motifAjustement && (
          <p className="text-muted-foreground text-xs">
            Ajustement : {reservation.motifAjustement}
          </p>
        )}
      </div>

      {isConfirmee && future && canWrite && (
        <SelfCheckinPanel
          reservationId={reservation.id}
          guestEmail={reservation.guest.email}
          canWrite={canWrite}
        />
      )}

      <div className="flex flex-col gap-2 border-t pt-3">
        <p className="text-muted-foreground text-xs font-bold tracking-wide uppercase">
          Actions
        </p>
        {actions.length === 0 ? (
          <p className="text-muted-foreground text-xs">
            {reservation.statut === 'TRANSFORMEE_EN_SEJOUR'
              ? 'Client déjà en séjour — actions disponibles depuis le module Séjour.'
              : 'Aucune action disponible pour ce statut ou vos permissions actuelles.'}
          </p>
        ) : (
          actions.map((action) => (
            <Button
              key={action.key}
              type="button"
              variant="outline"
              onClick={action.onClick}
              className={cn(
                'justify-start gap-2',
                action.tone === 'destructive' && 'text-destructive',
                action.tone === 'warning' && 'text-warning',
              )}
            >
              <action.icon className="size-4" />
              {action.label}
            </Button>
          ))
        )}
      </div>
    </>
  );
}

function Info({
  icon,
  label,
  value,
}: {
  icon?: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-2 text-sm">
      {icon && <span className="text-primary">{icon}</span>}
      <span className="text-muted-foreground">{label} :</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
