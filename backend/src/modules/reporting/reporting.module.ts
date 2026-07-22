import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ReportingController } from './reporting.controller';
import { FinancialReportingService } from './financial-reporting.service';
import { PoliceReportService } from './police-report.service';
import { YieldManagementService } from './yield-management.service';
import { ParametersModule } from '../parameters/parameters.module';
import { ReportingQueue } from './queues/reporting.queue';
import { ReportingProcessor } from './queues/reporting.processor';
import { REPORTING_QUEUE } from './queues/reporting-job.types';

// Read-only strict (docs/modules/reporting.md INV-REP-001) : dépend
// uniquement de parameters (taux de TVA, jamais dupliqués en dur) — accès
// aux autres entités (Stay, Guest, FolioLine, Folio) via PrismaService
// directement en lecture seule, pas de service métier importé pour éviter
// tout risque d'appeler par erreur une méthode d'écriture d'un autre module.
// registerQueue('reporting') + ReportingQueue/ReportingProcessor : exports
// volumineux exécutés en arrière-plan (voir queues/), additionnel au chemin
// synchrone existant, jamais un remplacement (INV-REP-001 reste respecté :
// le worker ne fait que lire, comme le reste du module).
@Module({
  imports: [
    ParametersModule,
    BullModule.registerQueue({ name: REPORTING_QUEUE }),
  ],
  controllers: [ReportingController],
  providers: [
    FinancialReportingService,
    PoliceReportService,
    YieldManagementService,
    ReportingQueue,
    ReportingProcessor,
  ],
})
export class ReportingModule {}
