import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { StatutNotification } from '@prisma/client';
import type { Job } from 'bullmq';
import { PrismaService } from '../../../prisma/prisma.service';
import { MailerService } from '../mailer.service';
import {
  NOTIFICATIONS_JOB,
  NOTIFICATIONS_QUEUE,
  SendEmailJobData,
} from './notifications-job.types';

// Worker : exécute l'envoi réel hors du thread de la requête HTTP — même
// convention que reporting/queues/reporting.processor.ts.
@Processor(NOTIFICATIONS_QUEUE)
export class NotificationsProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationsProcessor.name);

  constructor(
    private readonly mailerService: MailerService,
    private readonly prisma: PrismaService,
  ) {
    super();
  }

  async process(job: Job<SendEmailJobData, void, string>) {
    switch (job.name) {
      case NOTIFICATIONS_JOB.SEND_EMAIL: {
        const { notificationLogId, destinataire, sujet, corps } = job.data;
        try {
          await this.mailerService.send(destinataire, sujet, corps);
          await this.prisma.notificationLog.update({
            where: { id: notificationLogId },
            data: { statut: StatutNotification.ENVOYE, envoyeAt: new Date() },
          });
        } catch (error) {
          const message =
            error instanceof Error ? error.message : String(error);
          const isLastAttempt =
            job.attemptsMade + 1 >= (job.opts.attempts ?? 1);
          // Ne marquer ECHEC qu'à la dernière tentative — sinon un échec
          // transitoire (SMTP momentanément injoignable) écraserait le
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
        return;
      }
      default:
        throw new Error(`Job notification inconnu : "${job.name}".`);
    }
  }
}
