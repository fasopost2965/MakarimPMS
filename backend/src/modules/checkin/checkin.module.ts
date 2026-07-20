import { Module } from '@nestjs/common';
import { CheckinController } from './checkin.controller';
import { CheckinService } from './checkin.service';
import { RoomsModule } from '../rooms/rooms.module';
import { GuestsModule } from '../guests/guests.module';

@Module({
  imports: [RoomsModule, GuestsModule],
  controllers: [CheckinController],
  providers: [CheckinService],
  exports: [CheckinService],
})
export class CheckinModule {}
