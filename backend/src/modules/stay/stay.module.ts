import { Module } from '@nestjs/common';
import { StayController } from './stay.controller';
import { StayService } from './stay.service';
import { RoomsModule } from '../rooms/rooms.module';
import { GuestsModule } from '../guests/guests.module';

@Module({
  imports: [RoomsModule, GuestsModule],
  controllers: [StayController],
  providers: [StayService],
  exports: [StayService],
})
export class StayModule {}
