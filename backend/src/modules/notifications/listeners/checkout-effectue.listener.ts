import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { EvenementNotification } from '@prisma/client';
import { StayService } from '../../stay/stay.service';
import { CheckoutEffectueEvent } from '../../stay/events/checkout-effectue.event';
import { NotificationsService } from '../notifications.service';

function formatDate(date: Date): string {
  return date.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

// Distinct de housekeeping/listeners/checkout-effectue.listener.ts (même
// évènement, deux modules qui réagissent indépendamment — le ménage passe
// la chambre à nettoyer, celui-ci déclenche l'email post-séjour).
@Injectable()
export class CheckoutEffectueListener {
  constructor(
    private readonly stayService: StayService,
    private readonly notificationsService: NotificationsService,
  ) {}

  @OnEvent('checkout.effectue')
  async handle(event: CheckoutEffectueEvent) {
    // Façade stay (jamais de lecture Prisma directe hors du module).
    const stay = await this.stayService.findOne(event.stayId);

    await this.notificationsService.notify(
      EvenementNotification.POST_SEJOUR,
      stay.guestId,
      stay.reservationId,
      {
        nom: stay.guest.nom,
        prenom: stay.guest.prenom,
        chambre: `${stay.room.numero} (${stay.room.roomType.nom})`,
        dateDepart: formatDate(
          stay.dateCheckoutReelle ?? stay.dateCheckoutPrevue,
        ),
      },
    );
  }
}
