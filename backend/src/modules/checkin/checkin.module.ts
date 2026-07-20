import { Module } from '@nestjs/common';
import { CheckinController } from './checkin.controller';
import { CheckinService } from './checkin.service';
import { HousekeepingModule } from '../housekeeping/housekeeping.module';
import { GuestsModule } from '../guests/guests.module';

@Module({
  imports: [HousekeepingModule, GuestsModule],
  controllers: [CheckinController],
  providers: [CheckinService],
})
export class CheckinModule {}
