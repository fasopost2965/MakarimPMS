import { Module } from '@nestjs/common';
import { ParametersModule } from '../parameters/parameters.module';
import { ReservationsModule } from '../reservations/reservations.module';
import { StayModule } from '../stay/stay.module';
import { HousekeepingModule } from '../housekeeping/housekeeping.module';
import { MaintenanceModule } from '../maintenance/maintenance.module';
import { AuditModule } from '../audit/audit.module';
import { NightAuditController } from './night-audit.controller';
import { NightAuditService } from './night-audit.service';
import { BusinessDateService } from './business-date.service';

// ARCH-011A — module feuille côté écriture (ne mute jamais les tables des
// modules importés ci-dessous, uniquement leurs façades en lecture) mais
// dépend de nombreux modules en façade, même position dans le graphe de
// dépendances que `reporting` (docs/DEPENDENCY_GRAPH.md).
@Module({
  imports: [
    ParametersModule,
    ReservationsModule,
    StayModule,
    HousekeepingModule,
    MaintenanceModule,
    AuditModule,
  ],
  controllers: [NightAuditController],
  providers: [NightAuditService, BusinessDateService],
  exports: [BusinessDateService],
})
export class NightAuditModule {}
