import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { MailerService } from './mailer.service';
import { TwilioService } from './twilio.service';
import { NotificationsQueue } from './queues/notifications.queue';
import { NotificationsProcessor } from './queues/notifications.processor';
import { NOTIFICATIONS_QUEUE } from './queues/notifications-job.types';
import { AuditModule } from '../audit/audit.module';
import { GuestsModule } from '../guests/guests.module';
import { ReservationsModule } from '../reservations/reservations.module';
import { StayModule } from '../stay/stay.module';
import { ReservationConfirmeeListener } from './listeners/reservation-confirmee.listener';
import { CheckoutEffectueListener } from './listeners/checkout-effectue.listener';
import { RappelJMoins1Cron } from './cron/rappel-j-moins-1.cron';

// notifications est le CONSOMMATEUR des évènements reservation.confirmee
// (ReservationsService) et checkout.effectue (StayService) — même
// convention que housekeeping/listeners/checkout-effectue.listener.ts : le
// listener vit dans le module qui agit sur l'évènement, pas dans celui qui
// l'émet (ReservationsModule/StayModule n'importent jamais ce module en
// retour). GuestsModule : façade GuestsService.findOne (email/consentement
// figés au moment de l'envoi, jamais de lecture Prisma directe de Guest).
// ReservationsModule/StayModule : façades findOne/findConfirmedArrivingOn
// pour reconstituer le contexte complet à partir des ids portés par les
// évènements/le cron.
@Module({
  imports: [
    AuditModule,
    GuestsModule,
    ReservationsModule,
    StayModule,
    BullModule.registerQueue({ name: NOTIFICATIONS_QUEUE }),
  ],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    MailerService,
    TwilioService,
    NotificationsQueue,
    NotificationsProcessor,
    ReservationConfirmeeListener,
    CheckoutEffectueListener,
    RappelJMoins1Cron,
  ],
  // MailerService exporté en plus de NotificationsService — CH-002
  // (docs/governance/REGISTRE_CHANTIERS.md) : AuthService.forgotPassword()
  // doit envoyer un email de réinitialisation, mais NotificationsService.notify()
  // est structurellement scopé à Guest (guestId obligatoire, NotificationLog.guestId
  // référence Guest, jamais User) — un compte User (personnel) n'a pas sa place
  // dans ce flux CRM/marketing. MailerService est un wrapper SMTP générique
  // sans dépendance à Guest/NotificationLog : le réutiliser tel quel évite de
  // dupliquer l'envoi SMTP dans le module auth, sans détourner le pipeline
  // Guest pour un évènement qui ne concerne jamais un client de l'hôtel.
  exports: [NotificationsService, MailerService],
})
export class NotificationsModule {}
