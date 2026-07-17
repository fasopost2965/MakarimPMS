import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
} from '@nestjs/common';
import { CheckinService } from './checkin.service';
import { WalkinCheckinDto } from './dto/walkin-checkin.dto';

// TODO(core 5.1/5.2) : protéger ces routes avec JwtAuthGuard + RolesGuard
// une fois le module core (auth/rôles) livré — voir skill creer-module-brique.
@Controller()
export class CheckinController {
  constructor(private readonly checkinService: CheckinService) {}

  @Post('checkin/walk-in')
  checkinWalkIn(@Body() dto: WalkinCheckinDto) {
    return this.checkinService.checkinWalkIn(dto);
  }

  @Post('checkin/:reservationId')
  checkinFromReservation(
    @Param('reservationId', ParseIntPipe) reservationId: number,
  ) {
    return this.checkinService.checkinFromReservation(reservationId);
  }

  @Get('stays/en-cours')
  findEnCours() {
    return this.checkinService.findEnCours();
  }

  @Get('stays/departs-du-jour')
  departsToday() {
    return this.checkinService.departsToday();
  }

  @Get('stays/:id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.checkinService.findOne(id);
  }

  @Post('checkout/:stayId')
  checkout(@Param('stayId', ParseIntPipe) stayId: number) {
    return this.checkinService.checkout(stayId);
  }
}
