import { Module } from '@nestjs/common';
import { HousekeepingController } from './housekeeping.controller';
import { HousekeepingService } from './housekeeping.service';
import { CheckoutEffectueListener } from './listeners/checkout-effectue.listener';

@Module({
  controllers: [HousekeepingController],
  providers: [HousekeepingService, CheckoutEffectueListener],
  exports: [HousekeepingService],
})
export class HousekeepingModule {}
