import { Module } from '@nestjs/common';
import { SelfCheckinController } from './self-checkin.controller';
import { SelfCheckinService } from './self-checkin.service';
import { ReservationsModule } from '../reservations/reservations.module';
import { GuestsModule } from '../guests/guests.module';
import { NotificationsModule } from '../notifications/notifications.module';

// F6 — façades reservations (contexte réservation)/guests (écriture des
// champs déjà soumis)/notifications (envoi du lien, réutilise le canal
// email de F7) — jamais de Prisma direct sur Reservation/Guest hors de ce
// module pour ces entités, uniquement sur SelfCheckinToken qui lui
// appartient en propre.
@Module({
  imports: [ReservationsModule, GuestsModule, NotificationsModule],
  controllers: [SelfCheckinController],
  providers: [SelfCheckinService],
})
export class SelfCheckinModule {}
