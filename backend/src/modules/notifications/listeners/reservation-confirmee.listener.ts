import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { EvenementNotification } from '@prisma/client';
import { ReservationsService } from '../../reservations/reservations.service';
import { ReservationConfirmeeEvent } from '../../reservations/events/reservation-confirmee.event';
import { NotificationsService } from '../notifications.service';

function formatDate(date: Date): string {
  return date.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

@Injectable()
export class ReservationConfirmeeListener {
  constructor(
    private readonly reservationsService: ReservationsService,
    private readonly notificationsService: NotificationsService,
  ) {}

  @OnEvent('reservation.confirmee')
  async handle(event: ReservationConfirmeeEvent) {
    // Façade reservations (jamais de lecture Prisma directe hors du
    // module) — l'évènement ne porte que l'id, la donnée complète est
    // relue ici au moment du traitement.
    const reservation = await this.reservationsService.findOne(
      event.reservationId,
    );

    await this.notificationsService.notify(
      EvenementNotification.RESERVATION_CONFIRMEE,
      reservation.guestId,
      reservation.id,
      {
        nom: reservation.guest.nom,
        prenom: reservation.guest.prenom,
        chambre: `${reservation.room.numero} (${reservation.room.roomType.nom})`,
        dateArrivee: formatDate(reservation.dateArrivee),
        dateDepart: formatDate(reservation.dateDepart),
      },
    );
  }
}
