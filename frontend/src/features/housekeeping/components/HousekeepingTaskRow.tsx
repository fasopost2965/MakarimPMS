import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { HousekeepingTask, StatutTacheHousekeeping } from '../types';
import type { Room, StatutChambre } from '../../reservations/types';

const STATUT_LABEL: Record<StatutChambre, string> = {
  LIBRE_PROPRE: 'Libre & propre',
  RESERVEE: 'Réservée',
  OCCUPEE: 'Occupée',
  DEPART_PREVU: 'Départ prévu',
  A_NETTOYER: 'À nettoyer',
  EN_NETTOYAGE: 'En nettoyage',
  EN_MAINTENANCE: 'En maintenance',
};

const STATUT_BADGE_VARIANT: Record<
  StatutChambre,
  'success' | 'info' | 'destructive' | 'warning' | 'violet'
> = {
  LIBRE_PROPRE: 'success',
  RESERVEE: 'info',
  OCCUPEE: 'destructive',
  DEPART_PREVU: 'info',
  A_NETTOYER: 'warning',
  EN_NETTOYAGE: 'violet',
  EN_MAINTENANCE: 'destructive',
};

const TASK_STATUT_LABEL: Record<StatutTacheHousekeeping, string> = {
  A_FAIRE: 'À faire',
  AFFECTEE: 'Affectée',
  EN_COURS: 'En cours',
  TERMINEE: 'Terminée',
  VALIDEE: 'Validée',
  ANNULEE: 'Annulée',
};

const TASK_STATUT_BADGE_VARIANT: Record<
  StatutTacheHousekeeping,
  'default' | 'secondary' | 'success' | 'destructive' | 'warning' | 'violet'
> = {
  A_FAIRE: 'warning',
  AFFECTEE: 'secondary',
  EN_COURS: 'violet',
  TERMINEE: 'default',
  VALIDEE: 'success',
  ANNULEE: 'destructive',
};

interface HousekeepingTaskRowProps {
  room: Room;
  task: HousekeepingTask;
  permissions?: string[] | null;
  onShowHistory: () => void;
  onAssign: () => void;
  onStart: () => void;
  onComplete: () => void;
  onValidate: () => void;
  onRefuse: () => void;
  onCancel: () => void;
  onReopen: () => void;
  onTaskHistory: () => void;
  disabled?: boolean;
}

export function HousekeepingTaskRow({
  room,
  task,
  permissions,
  onShowHistory,
  onAssign,
  onStart,
  onComplete,
  onValidate,
  onRefuse,
  onCancel,
  onReopen,
  onTaskHistory,
  disabled,
}: HousekeepingTaskRowProps) {
  const hasWrite = permissions?.includes('housekeeping:write');
  const hasControl = permissions?.includes('housekeeping:control');
  const hasRead = permissions?.includes('housekeeping:read');

  return (
    <div className="hover:bg-muted/40 grid grid-cols-[minmax(0,1fr)_minmax(130px,auto)] items-center gap-2 border-b px-4 py-3 text-sm last:border-b-0 md:grid-cols-[80px_1fr_170px_150px] md:py-2.5">
      <button
        type="button"
        onClick={onShowHistory}
        className="focus-visible:ring-ring rounded text-left font-bold outline-none hover:underline focus-visible:ring-2"
        aria-label={`Voir l’historique de la chambre ${room.numero}`}
      >
        {room.numero}
      </button>
      <span className="text-muted-foreground col-start-1 row-start-2 text-xs md:col-start-2 md:row-start-1 flex items-center gap-2">
        {room.roomType.nom}
        <Badge
          variant={TASK_STATUT_BADGE_VARIANT[task.statut]}
          className="text-[10px] ml-2"
        >
          {TASK_STATUT_LABEL[task.statut]}
        </Badge>
        {task.assignedUser && (
          <span className="text-xs text-muted-foreground ml-2 truncate max-w-[100px]">
            {task.assignedUser.nom}
          </span>
        )}
      </span>
      <span className="col-start-1 row-start-3 md:col-start-3 md:row-start-1">
        <Badge variant={STATUT_BADGE_VARIANT[room.statut]}>
          {STATUT_LABEL[room.statut]}
        </Badge>
      </span>
      <span className="col-start-2 row-span-3 row-start-1 flex justify-end md:col-start-4 md:row-span-1 gap-1">
        {task.statut === 'A_FAIRE' && hasWrite && (
          <>
            <Button
              size="sm"
              variant="outline"
              onClick={onAssign}
              disabled={disabled}
            >
              Affecter
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={onCancel}
              disabled={disabled}
            >
              Annuler
            </Button>
          </>
        )}
        {task.statut === 'AFFECTEE' && hasWrite && (
          <>
            <Button
              size="sm"
              variant="outline"
              onClick={onStart}
              disabled={disabled}
            >
              Démarrer
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={onAssign}
              disabled={disabled}
            >
              Réaffecter
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={onCancel}
              disabled={disabled}
            >
              Annuler
            </Button>
          </>
        )}
        {task.statut === 'EN_COURS' && hasWrite && (
          <Button
            size="sm"
            variant="default"
            onClick={onComplete}
            disabled={disabled}
          >
            Terminer
          </Button>
        )}
        {task.statut === 'TERMINEE' && hasControl && (
          <>
            <Button
              size="sm"
              variant="success"
              onClick={onValidate}
              disabled={disabled}
            >
              Valider
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={onRefuse}
              disabled={disabled}
            >
              Refuser
            </Button>
          </>
        )}
        {task.statut === 'VALIDEE' && hasRead && (
          <Button
            size="sm"
            variant="outline"
            onClick={onTaskHistory}
            disabled={disabled}
          >
            Historique
          </Button>
        )}
        {task.statut === 'VALIDEE' && hasControl && (
          <Button
            size="sm"
            variant="outline"
            onClick={onReopen}
            disabled={disabled}
          >
            Réouvrir
          </Button>
        )}
        {task.statut === 'ANNULEE' && hasRead && (
          <Button
            size="sm"
            variant="outline"
            onClick={onTaskHistory}
            disabled={disabled}
          >
            Historique
          </Button>
        )}
      </span>
    </div>
  );
}
