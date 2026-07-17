import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { ReservationsModule } from './modules/reservations/reservations.module';
import { CheckinModule } from './modules/checkin/checkin.module';
import { HousekeepingModule } from './modules/housekeeping/housekeeping.module';
import { BillingModule } from './modules/billing/billing.module';

@Module({
  imports: [
    PrismaModule,
    ReservationsModule,
    CheckinModule,
    HousekeepingModule,
    BillingModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
