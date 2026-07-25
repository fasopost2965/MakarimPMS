import { Module } from '@nestjs/common';
import { ReservationsController } from './reservations.controller';
import { ReservationsService } from './reservations.service';
import { CancellationPolicyController } from './cancellation-policy.controller';
import { CancellationPolicyService } from './cancellation-policy.service';
import { GuestsModule } from '../guests/guests.module';
import { AuditModule } from '../audit/audit.module';
import { RoomsModule } from '../rooms/rooms.module';
import { ParametersModule } from '../parameters/parameters.module';

@Module({
  imports: [GuestsModule, AuditModule, RoomsModule, ParametersModule],
  controllers: [ReservationsController, CancellationPolicyController],
  providers: [ReservationsService, CancellationPolicyService],
  exports: [ReservationsService],
})
export class ReservationsModule {}
