import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import {
  NOTIFICATIONS_JOB,
  NOTIFICATIONS_QUEUE,
  SendEmailJobData,
} from './notifications-job.types';

// Producteur : dépose des jobs, ne fait jamais l'envoi lui-même (voir
// NotificationsProcessor) — même convention que
// reporting/queues/reporting.queue.ts.
@Injectable()
export class NotificationsQueue {
  constructor(
    @InjectQueue(NOTIFICATIONS_QUEUE) private readonly queue: Queue,
  ) {}

  async enqueueSendEmail(data: SendEmailJobData) {
    const job = await this.queue.add(NOTIFICATIONS_JOB.SEND_EMAIL, data, {
      // Un envoi qui échoue (SMTP injoignable ponctuellement) mérite un
      // nouvel essai automatique, contrairement à l'export comptable
      // (reporting) — jamais plus de 3 tentatives pour ne pas spammer un
      // client si l'échec est en réalité définitif (adresse invalide).
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: { age: 3600 },
      removeOnFail: { age: 86_400 },
    });
    return { jobId: job.id! };
  }
}
