import { Module } from '@nestjs/common';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { ParametersModule } from '../parameters/parameters.module';
import { AuditModule } from '../audit/audit.module';

// AuditModule : trace EXCLUDE_FOLIO_TAX (exclusion de taxe sur un folio) —
// même obligation ADR-005/writeLog que toute opération sensible.
@Module({
  imports: [ParametersModule, AuditModule],
  controllers: [BillingController],
  providers: [BillingService],
  exports: [BillingService],
})
export class BillingModule {}
