import { Module } from '@nestjs/common';
import { ReportingController } from './reporting.controller';
import { FinancialReportingService } from './financial-reporting.service';
import { PoliceReportService } from './police-report.service';
import { ParametersModule } from '../parameters/parameters.module';

// Read-only strict (docs/modules/reporting.md INV-REP-001) : dépend
// uniquement de parameters (taux de TVA, jamais dupliqués en dur) — accès
// aux autres entités (Stay, Guest, FolioLine, Folio) via PrismaService
// directement en lecture seule, pas de service métier importé pour éviter
// tout risque d'appeler par erreur une méthode d'écriture d'un autre module.
@Module({
  imports: [ParametersModule],
  controllers: [ReportingController],
  providers: [FinancialReportingService, PoliceReportService],
})
export class ReportingModule {}
