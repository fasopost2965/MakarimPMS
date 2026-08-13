import { Ban } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { MaintenanceTicket } from '../../maintenance/types';
import type { Room } from '../../reservations/types';
import type { HousekeepingTask } from '../types';
import {
  ROOM_STATUT_BADGE_VARIANT,
  ROOM_STATUT_LABEL,
  TASK_STATUT_BADGE_VARIANT,
  TASK_STATUT_LABEL,
  floorLabel,
} from '../utils/labels';

export interface RoomsFloorGroup {
  etage: number | null;
  rooms: Room[];
}

interface Props {
  groupedByFloor: RoomsFloorGroup[];
  taskByRoomId: Map<number, HousekeepingTask>;
  maintenanceByRoomId: Map<number, MaintenanceTicket>;
  hasWrite: boolean;
  disabled?: boolean;
  onRoomClick: (room: Room) => void;
  onCreateTask: (room: Room) => void;
}

// DESIGN-008 — cartes cliquables groupées par étage, reprises du
// prototype PrototypeHousekeepingA : clic → RoomContextModal (géré par le
// parent, jamais un second modal chambre). Seul ajout par rapport au
// prototype (pur exploratoire, données mock) : un bouton « Créer une
// tâche » pour une chambre A_NETTOYER sans tâche active — fonctionnalité
// réelle de l'ancien écran de production (HousekeepingTaskCreateDialog),
// absente du prototype mais nécessaire pour ne pas régresser.
export function HousekeepingRoomsView({
  groupedByFloor,
  taskByRoomId,
  maintenanceByRoomId,
  hasWrite,
  disabled,
  onRoomClick,
  onCreateTask,
}: Props) {
  if (groupedByFloor.length === 0) {
    return (
      <p className="text-muted-foreground py-10 text-center text-sm">
        Aucune chambre ne correspond aux filtres.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {groupedByFloor.map(({ etage, rooms }) => (
        <div key={etage ?? 'sans-etage'} className="flex flex-col gap-2">
          <p className="text-muted-foreground text-[11px] font-bold tracking-wide uppercase">
            {floorLabel(etage)}
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            {rooms.map((room) => {
              const task = taskByRoomId.get(room.id);
              const maintenance = maintenanceByRoomId.get(room.id);
              const canCreateTask =
                hasWrite && !task && room.statut === 'A_NETTOYER';

              return (
                // Un <div role="button"> plutôt qu'un <button> imbriqué :
                // ce dernier contient conditionnellement un vrai <button>
                // (« Créer une tâche »), et un bouton interactif dans un
                // bouton interactif est un DOM invalide (violation HTML5,
                // constatée en QA live — casse la cible de clic et
                // l'arbre d'accessibilité). Clavier préservé (Enter/Espace).
                <div
                  key={room.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => onRoomClick(room)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      onRoomClick(room);
                    }
                  }}
                  className="bg-card hover:border-primary/50 focus-visible:ring-ring/50 flex cursor-pointer flex-col gap-2 rounded-lg border p-3 text-left transition-colors focus-visible:ring-3 focus-visible:outline-none"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-base font-bold">{room.numero}</span>
                    <Badge variant={ROOM_STATUT_BADGE_VARIANT[room.statut]}>
                      {ROOM_STATUT_LABEL[room.statut]}
                    </Badge>
                  </div>
                  <span className="text-muted-foreground text-xs">
                    {room.roomType.nom}
                  </span>
                  {task && (
                    <div className="flex flex-col gap-1 border-t pt-2 text-xs">
                      <Badge
                        variant={TASK_STATUT_BADGE_VARIANT[task.statut]}
                        className="w-fit"
                      >
                        {TASK_STATUT_LABEL[task.statut]}
                      </Badge>
                      <span className="text-muted-foreground truncate">
                        {task.assignedUser?.nom ?? 'Aucun agent affecté'}
                      </span>
                    </div>
                  )}
                  {maintenance && (
                    <div className="border-destructive/30 text-destructive flex items-center gap-1 border-t pt-2 text-xs font-medium">
                      <Ban className="size-3" />
                      Bloquant · {maintenance.typePanne}
                    </div>
                  )}
                  {canCreateTask && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-1"
                      disabled={disabled}
                      onClick={(event) => {
                        event.stopPropagation();
                        onCreateTask(room);
                      }}
                    >
                      Créer une tâche
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
