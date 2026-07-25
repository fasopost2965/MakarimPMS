import { Module } from '@nestjs/common';
import { StayController } from './stay.controller';
import { StayService } from './stay.service';
import { RoomsModule } from '../rooms/rooms.module';
import { GuestsModule } from '../guests/guests.module';
import { BillingModule } from '../billing/billing.module';
import { AuditModule } from '../audit/audit.module';

// BillingModule : imputation des acomptes (ReservationDeposit) au folio
// principal via BillingService.creditFolioLine au check-in — dépendance
// sanctionnée par docs/DEPENDENCY_GRAPH.md (arête M6 stay → M7 billing).
@Module({
  imports: [RoomsModule, GuestsModule, BillingModule, AuditModule],
  controllers: [StayController],
  providers: [StayService],
  exports: [StayService],
})
export class StayModule {}
