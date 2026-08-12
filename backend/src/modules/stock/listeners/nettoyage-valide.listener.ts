import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { StockService } from '../stock.service';
import { NettoyageValideEvent } from '../../housekeeping/events/nettoyage-valide.event';

// L'événement est un accélérateur uniquement. Les intentions PENDING sont
// durables et peuvent être reprises sans créer de doublon.
@Injectable()
export class NettoyageValideListener {
  private readonly logger = new Logger(NettoyageValideListener.name);

  constructor(private readonly stockService: StockService) {}

  @OnEvent('nettoyage.valide')
  async handle(event: NettoyageValideEvent) {
    try {
      await this.stockService.processHousekeepingCycle(
        event.housekeepingTaskId,
        event.cycle,
      );
    } catch (error) {
      this.logger.warn(
        `Décompte de stock automatique en échec pour la tâche ${event.housekeepingTaskId}, cycle ${event.cycle} : ${(error as Error).message}`,
      );
    }
  }
}
