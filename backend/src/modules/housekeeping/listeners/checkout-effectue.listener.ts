import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { CheckoutEffectueEvent } from '../../stay/events/checkout-effectue.event';
import { HousekeepingTaskService } from '../housekeeping-task.service';

@Injectable()
export class CheckoutEffectueListener {
  private readonly logger = new Logger(CheckoutEffectueListener.name);

  constructor(
    private readonly housekeepingTaskService: HousekeepingTaskService,
  ) {}

  @OnEvent('checkout.effectue')
  async handle(event: CheckoutEffectueEvent) {
    try {
      await this.housekeepingTaskService.handleCheckoutEffectue(
        event.stayId,
        event.roomId,
      );
      this.logger.log(
        `Tâche de ménage traitée pour le checkout ${event.stayId} de la chambre ${event.roomId}`,
      );
    } catch (error) {
      this.logger.error(
        `Erreur lors de la création de la tâche de ménage pour le checkout ${event.stayId}`,
        error,
      );
      // Ne pas propager l'erreur pour ne pas casser le processus de check-out existant
      // (bien que l'événement soit généralement asynchrone / post-commit).
    }
  }
}
