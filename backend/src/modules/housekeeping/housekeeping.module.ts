import { Module } from '@nestjs/common';
import { HousekeepingController } from './housekeeping.controller';
import { HousekeepingService } from './housekeeping.service';
import { CheckoutEffectueListener } from './listeners/checkout-effectue.listener';
import { RoomsModule } from '../rooms/rooms.module';
import { ReservationsModule } from '../reservations/reservations.module';
import { CheckinModule } from '../checkin/checkin.module';

@Module({
  imports: [RoomsModule, ReservationsModule, CheckinModule],
  controllers: [HousekeepingController],
  providers: [HousekeepingService, CheckoutEffectueListener],
  exports: [HousekeepingService],
})
export class HousekeepingModule {}
