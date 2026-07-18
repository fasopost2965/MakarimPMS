import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { StatutChambre } from '@prisma/client';
import { HousekeepingService } from '../housekeeping.service';
import { CheckoutEffectueEvent } from '../../checkin/events/checkout-effectue.event';

// Concrétise le déclenchement automatique du ménage au check-out (cahier des
// charges §5.6 Phase 2) : la chambre passe en À nettoyer via la machine à
// états, jamais par une écriture directe de CheckinService.
@Injectable()
export class CheckoutEffectueListener {
  constructor(private readonly housekeepingService: HousekeepingService) {}

  @OnEvent('checkout.effectue')
  async handle(event: CheckoutEffectueEvent) {
    await this.housekeepingService.transitionRoom(
      event.roomId,
      StatutChambre.A_NETTOYER,
      { motif: 'Check-out effectué', userId: event.userId },
    );
  }
}
