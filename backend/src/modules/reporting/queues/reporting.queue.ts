import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import {
  ExportGrandLivreJobData,
  REPORTING_JOB,
  REPORTING_QUEUE,
} from './reporting-job.types';

// Producteur : dépose des jobs dans la file, ne fait jamais le travail lui-
// même (voir ReportingProcessor pour l'exécution réelle, côté worker, hors
// du thread de la requête HTTP entrante).
@Injectable()
export class ReportingQueue {
  constructor(@InjectQueue(REPORTING_QUEUE) private readonly queue: Queue) {}

  async enqueueExportGrandLivre(data: ExportGrandLivreJobData) {
    const job = await this.queue.add(
      REPORTING_JOB.EXPORT_GRAND_LIVRE,
      data,
      // Pas de retry automatique : un export comptable rejoué à l'identique
      // en cas d'échec doit rester une décision humaine explicite (nouvel
      // appel), pas un comportement silencieux de la file.
      {
        attempts: 1,
        removeOnComplete: { age: 3600 },
        removeOnFail: { age: 86_400 },
      },
    );
    return { jobId: job.id! };
  }

  async getJobStatus(jobId: string) {
    const job = await this.queue.getJob(jobId);
    if (!job) {
      return null;
    }
    const state = await job.getState();
    return {
      jobId: job.id,
      state,
      result: state === 'completed' ? (job.returnvalue as string) : null,
      failedReason: state === 'failed' ? job.failedReason : null,
    };
  }
}
