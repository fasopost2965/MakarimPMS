import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { OrigineTacheHousekeeping } from '@prisma/client';
import { RoomChangedEvent } from '../../stay/events/room-changed.event';
import { HousekeepingTaskService } from '../housekeeping-task.service';

@Injectable()
export class RoomChangedListener {
  private readonly logger = new Logger(RoomChangedListener.name);

  constructor(
    private readonly housekeepingTaskService: HousekeepingTaskService,
  ) {}

  @OnEvent('stay.room-changed')
  async handle(event: RoomChangedEvent) {
    try {
      const sourceEventKey = `room-change:${event.stayId}:${event.oldRoomId}->${event.newRoomId}`;
      await this.housekeepingTaskService.createTask(
        event.oldRoomId,
        OrigineTacheHousekeeping.CHANGE_ROOM,
        sourceEventKey,
      );
      this.logger.log(
        `Tâche de ménage créée pour le changement de chambre du séjour #${event.stayId} (${event.oldRoomId} → ${event.newRoomId})`,
      );
    } catch (error) {
      this.logger.error(
        `Erreur lors de la création de la tâche de ménage pour le changement de chambre du séjour #${event.stayId}`,
        error,
      );
      // Ne pas propager l'erreur pour ne pas casser le processus de changement
      // de chambre existant.
    }
  }
}
