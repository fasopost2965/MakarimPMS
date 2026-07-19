import { Module } from '@nestjs/common';
import { ReservationsController } from './reservations.controller';
import { ReservationsService } from './reservations.service';
import { GuestsModule } from '../guests/guests.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [GuestsModule, AuditModule],
  controllers: [ReservationsController],
  providers: [ReservationsService],
  exports: [ReservationsService],
})
export class ReservationsModule {}
