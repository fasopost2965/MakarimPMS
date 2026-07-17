import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { ReservationsModule } from './modules/reservations/reservations.module';
import { CheckinModule } from './modules/checkin/checkin.module';
import { HousekeepingModule } from './modules/housekeeping/housekeeping.module';

@Module({
  imports: [
    PrismaModule,
    ReservationsModule,
    CheckinModule,
    HousekeepingModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
