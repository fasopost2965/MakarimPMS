import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { StatutNotification } from '@prisma/client';
import type { Job } from 'bullmq';
import { PrismaService } from '../../../prisma/prisma.service';
import { MailerService } from '../mailer.service';
import { TwilioService } from '../twilio.service';
import {
  NOTIFICATIONS_JOB,
  NOTIFICATIONS_QUEUE,
  SendEmailJobData,
  SendSmsJobData,
  SendWhatsappJobData,
} from './notifications-job.types';

type NotificationJobData =
  SendEmailJobData | SendSmsJobData | SendWhatsappJobData;

// Worker : exécute l'envoi réel hors du thread de la requête HTTP — même
// convention que reporting/queues/reporting.processor.ts.
@Processor(NOTIFICATIONS_QUEUE)
export class NotificationsProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationsProcessor.name);

  constructor(
    private readonly mailerService: MailerService,
    private readonly twilioService: TwilioService,
    private readonly prisma: PrismaService,
  ) {
    super();
  }

  async process(job: Job<NotificationJobData, void, string>) {
    switch (job.name) {
      case NOTIFICATIONS_JOB.SEND_EMAIL: {
        const { notificationLogId, destinataire, sujet, corps } =
          job.data as SendEmailJobData;
        await this.dispatch(job, notificationLogId, () =>
          this.mailerService.send(destinataire, sujet, corps),
        );
        return;
      }
      case NOTIFICATIONS_JOB.SEND_SMS: {
        const { notificationLogId, destinataire, corps } = job.data;
        await this.dispatch(job, notificationLogId, () =>
          this.twilioService.sendSms(destinataire, corps),
        );
        return;
      }
      case NOTIFICATIONS_JOB.SEND_WHATSAPP: {
        const { notificationLogId, destinataire, corps } = job.data;
        await this.dispatch(job, notificationLogId, () =>
          this.twilioService.sendWhatsapp(destinataire, corps),
        );
        return;
      }
      default:
        throw new Error(`Job notification inconnu : "${job.name}".`);
    }
  }

  // Logique d'envoi/retry commune aux 3 canaux — seule la fonction d'envoi
  // (send) change d'un canal à l'autre.
  private async dispatch(
    job: Job<NotificationJobData, void, string>,
    notificationLogId: number,
    send: () => Promise<void>,
  ) {
    try {
      await send();
      await this.prisma.notificationLog.update({
        where: { id: notificationLogId },
        data: { statut: StatutNotification.ENVOYE, envoyeAt: new Date() },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const isLastAttempt = job.attemptsMade + 1 >= (job.opts.attempts ?? 1);
      // Ne marquer ECHEC qu'à la dernière tentative — sinon un échec
      // transitoire (SMTP/Twilio momentanément injoignable) écraserait le
      // statut avant même que BullMQ n'ait rejoué le job avec succès.
      if (isLastAttempt) {
        await this.prisma.notificationLog.update({
          where: { id: notificationLogId },
          data: { statut: StatutNotification.ECHEC, erreur: message },
        });
      }
      this.logger.warn(
        `Échec envoi notification ${notificationLogId} (tentative ${job.attemptsMade + 1}) : ${message}`,
      );
      // Toujours relancer l'erreur : c'est ce qui déclenche le retry
      // BullMQ (attempts/backoff configurés dans NotificationsQueue).
      throw error;
    }
  }
}
