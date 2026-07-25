import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import {
  NOTIFICATIONS_JOB,
  NOTIFICATIONS_QUEUE,
  SendEmailJobData,
  SendSmsJobData,
  SendWhatsappJobData,
} from './notifications-job.types';

// Producteur : dépose des jobs, ne fait jamais l'envoi lui-même (voir
// NotificationsProcessor) — même convention que
// reporting/queues/reporting.queue.ts.
@Injectable()
export class NotificationsQueue {
  constructor(
    @InjectQueue(NOTIFICATIONS_QUEUE) private readonly queue: Queue,
  ) {}

  // Options communes aux 3 canaux : un envoi qui échoue (SMTP/Twilio
  // injoignable ponctuellement) mérite un nouvel essai automatique,
  // contrairement à l'export comptable (reporting) — jamais plus de 3
  // tentatives pour ne pas spammer un client si l'échec est en réalité
  // définitif (adresse/numéro invalide).
  private readonly jobOptions = {
    attempts: 3,
    backoff: { type: 'exponential' as const, delay: 5000 },
    removeOnComplete: { age: 3600 },
    removeOnFail: { age: 86_400 },
  };

  async enqueueSendEmail(data: SendEmailJobData) {
    const job = await this.queue.add(
      NOTIFICATIONS_JOB.SEND_EMAIL,
      data,
      this.jobOptions,
    );
    return { jobId: job.id! };
  }

  async enqueueSendSms(data: SendSmsJobData) {
    const job = await this.queue.add(
      NOTIFICATIONS_JOB.SEND_SMS,
      data,
      this.jobOptions,
    );
    return { jobId: job.id! };
  }

  async enqueueSendWhatsapp(data: SendWhatsappJobData) {
    const job = await this.queue.add(
      NOTIFICATIONS_JOB.SEND_WHATSAPP,
      data,
      this.jobOptions,
    );
    return { jobId: job.id! };
  }
}
