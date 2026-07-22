import { Module } from '@nestjs/common';
import { PoliceController } from './police.controller';
import { PoliceService } from './police.service';
import { AuditModule } from '../audit/audit.module';
import { StayModule } from '../stay/stay.module';
import { ParametersModule } from '../parameters/parameters.module';

// ParametersModule (F1) : en-tête de la fiche PDF (raisonSociale, adresse,
// ICE/RC/IF, categorieEtoiles) via ParametersService.getHotelConfig —
// jamais de lecture Prisma directe de HotelConfig hors du module parameters.
@Module({
  imports: [AuditModule, StayModule, ParametersModule],
  controllers: [PoliceController],
  providers: [PoliceService],
  exports: [PoliceService],
})
export class PoliceModule {}
