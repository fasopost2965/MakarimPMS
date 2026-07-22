import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import { FinancialReportingService } from '../financial-reporting.service';
import {
  ExportGrandLivreJobData,
  REPORTING_JOB,
  REPORTING_QUEUE,
} from './reporting-job.types';

// Worker : exécute le travail lourd (agrégation de FolioLine sur la
// période, sérialisation CSV) hors du thread de la requête HTTP — le
// endpoint /reporting/export synchrone existant (docs/modules/reporting.md
// §BR-REP-001) reste inchangé pour la compatibilité descendante ; cette
// file est une capacité additionnelle pour les exports volumineux ou les
// futures clôtures comptables (billing).
@Processor(REPORTING_QUEUE)
export class ReportingProcessor extends WorkerHost {
  private readonly logger = new Logger(ReportingProcessor.name);

  constructor(
    private readonly financialReportingService: FinancialReportingService,
  ) {
    super();
  }

  async process(job: Job<ExportGrandLivreJobData, string, string>) {
    switch (job.name) {
      case REPORTING_JOB.EXPORT_GRAND_LIVRE: {
        const { dateDebut, dateFin } = job.data;
        this.logger.log(
          `Export grand livre en arrière-plan (${dateDebut} → ${dateFin}), job ${job.id}`,
        );
        return this.financialReportingService.exportGrandLivre(
          dateDebut,
          dateFin,
        );
      }
      default:
        throw new Error(`Job reporting inconnu : "${job.name}".`);
    }
  }
}
