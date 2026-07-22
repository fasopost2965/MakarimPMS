import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { EvenementNotification } from '@prisma/client';
import { ReservationsService } from '../../reservations/reservations.service';
import { NotificationsService } from '../notifications.service';

function formatDate(date: Date): string {
  return date.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

// Rappel J-1 (F7) — même mécanisme @Cron que
// hr/attendance.service.ts:clorerShiftsOrphelins (ADR-007 §6.3),
// ScheduleModule.forRoot() déjà enregistré globalement par HrModule. Un
// déclenchement manqué (redémarrage du serveur pendant la fenêtre) n'est
// jamais rattrapé : ce n'est pas un état "relatif à aujourd'hui" recalculé
// à la lecture (housekeeping), c'est un envoi ponctuel — au pire un client
// ne reçoit pas son rappel un jour donné, sans conséquence sur l'intégrité
// des données.
@Injectable()
export class RappelJMoins1Cron {
  private readonly logger = new Logger(RappelJMoins1Cron.name);

  constructor(
    private readonly reservationsService: ReservationsService,
    private readonly notificationsService: NotificationsService,
  ) {}

  @Cron('0 9 * * *')
  async envoyerRappels() {
    const demain = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const reservations =
      await this.reservationsService.findConfirmedArrivingOn(demain);

    this.logger.log(
      `Rappel J-1 : ${reservations.length} réservation(s) arrivant le ${formatDate(demain)}.`,
    );

    for (const reservation of reservations) {
      await this.notificationsService.notify(
        EvenementNotification.RAPPEL_J_MOINS_1,
        reservation.guestId,
        reservation.id,
        {
          nom: reservation.guest.nom,
          prenom: reservation.guest.prenom,
          chambre: `${reservation.room.numero} (${reservation.room.roomType.nom})`,
          dateArrivee: formatDate(reservation.dateArrivee),
        },
      );
    }
  }
}
