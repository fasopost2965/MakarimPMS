import { Module } from '@nestjs/common';
import { CheckinController } from './checkin.controller';
import { CheckinService } from './checkin.service';
import { HousekeepingModule } from '../housekeeping/housekeeping.module';

@Module({
  imports: [HousekeepingModule],
  controllers: [CheckinController],
  providers: [CheckinService],
})
export class CheckinModule {}
