import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
} from '@nestjs/common';
import { HousekeepingService } from './housekeeping.service';
import { UpdateRoomStatusDto } from './dto/update-room-status.dto';

// TODO(core 5.1/5.2) : protéger ces routes avec JwtAuthGuard + RolesGuard
// une fois le module core (auth/rôles) livré — voir skill creer-module-brique.
@Controller()
export class HousekeepingController {
  constructor(private readonly housekeepingService: HousekeepingService) {}

  @Get('rooms')
  findAll() {
    return this.housekeepingService.findAllRooms();
  }

  @Patch('rooms/:id/statut')
  updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateRoomStatusDto,
  ) {
    return this.housekeepingService.updateStatus(id, dto.statut);
  }
}
