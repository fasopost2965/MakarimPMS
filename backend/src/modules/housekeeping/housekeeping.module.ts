import { Module } from '@nestjs/common';
import { HousekeepingController } from './housekeeping.controller';
import { HousekeepingService } from './housekeeping.service';
import { CheckoutEffectueListener } from './listeners/checkout-effectue.listener';
import { RoomsModule } from '../rooms/rooms.module';
import { ReservationsModule } from '../reservations/reservations.module';
import { StayModule } from '../stay/stay.module';

@Module({
  imports: [RoomsModule, ReservationsModule, StayModule],
  controllers: [HousekeepingController],
  providers: [HousekeepingService, CheckoutEffectueListener],
  exports: [HousekeepingService],
})
export class HousekeepingModule {}
