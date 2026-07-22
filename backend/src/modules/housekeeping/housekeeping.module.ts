import { Module } from '@nestjs/common';
import { HousekeepingController } from './housekeeping.controller';
import { MobileHousekeepingController } from './mobile-housekeeping.controller';
import { HousekeepingService } from './housekeeping.service';
import { CheckoutEffectueListener } from './listeners/checkout-effectue.listener';
import { RoomsModule } from '../rooms/rooms.module';
import { ReservationsModule } from '../reservations/reservations.module';
import { StayModule } from '../stay/stay.module';
import { AuthModule } from '../auth/auth.module';

// F9 — AuthModule importé uniquement pour AuthService.loginMobile()
// (façade, jamais de logique d'authentification dupliquée ici).
@Module({
  imports: [RoomsModule, ReservationsModule, StayModule, AuthModule],
  controllers: [HousekeepingController, MobileHousekeepingController],
  providers: [HousekeepingService, CheckoutEffectueListener],
  exports: [HousekeepingService],
})
export class HousekeepingModule {}
